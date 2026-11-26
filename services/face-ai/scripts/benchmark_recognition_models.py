"""CPU comparison of AuraFace and OpenCV Zoo SFace on the frozen local manifest."""
import argparse,csv,json,time,hashlib,statistics,resource
from pathlib import Path
import cv2,numpy as np,onnxruntime as ort
from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager

def metrics(scores,labels,t):
 tp=fp=tn=fn=0
 for s,y in zip(scores,labels):
  hit=s>=t
  if y and hit:tp+=1
  elif y:fn+=1
  elif hit:fp+=1
  else:tn+=1
 p=tp/(tp+fp) if tp+fp else 0;r=tp/(tp+fn) if tp+fn else 0
 return {'threshold':float(t),'tp':tp,'fp':fp,'tn':tn,'fn':fn,'precision':p,'recall':r,'f1':2*p*r/(p+r) if p+r else 0,'far':fp/(fp+tn) if fp+tn else 0,'frr':fn/(tp+fn) if tp+fn else 0}
def auc_eer(scores,labels):
 order=np.argsort(-np.asarray(scores)); y=np.asarray(labels,dtype=bool)[order]; tp=np.cumsum(y)/max(1,y.sum());fp=np.cumsum(~y)/max(1,(~y).sum());x=np.r_[0,fp];z=np.r_[0,tp];auc=float(np.sum((z[1:]+z[:-1])*np.diff(x)/2));i=int(np.argmin(np.abs(fp-(1-tp)))) if len(fp) else 0;return auc,float((fp[i]+1-tp[i])/2)
def evaluate(vectors,ids,split):
 scores=[];labels=[]
 for i in range(len(ids)):
  if vectors[i] is None or split[i]!=split[0]:continue
  for j in range(i+1,len(ids)):
   if vectors[j] is not None and split[j]==split[0]:scores.append(float(np.dot(vectors[i],vectors[j])));labels.append(ids[i]==ids[j])
 return scores,labels
def main():
 p=argparse.ArgumentParser();p.add_argument('image_root',type=Path);p.add_argument('manifest',type=Path);p.add_argument('--output',type=Path,required=True);p.add_argument('--limit',type=int,default=0);p.add_argument('--sface-model',default='/models/face_recognition_sface_2021dec.onnx');a=p.parse_args()
 st=get_settings();app=ModelManager(st);app.load()
 if not app.ready:raise SystemExit(f'AuraFace application model failed: {app.error}')
 sface=cv2.FaceRecognizerSF_create(a.sface_model,'')
 with a.manifest.open(newline='',encoding='utf-8-sig') as f:rows=list(csv.DictReader(f))
 if a.limit:rows=rows[:a.limit]
 vectors={'auraface':[],'sface':[]};lat={'auraface':[],'sface':[]};fails={'auraface':[],'sface':[]}
 records=[]
 for ix,row in enumerate(rows,1):
  path=a.image_root/row['image'];rec={'image':row['image'],'identity':row['identity'],'split':row['split']}
  try:
   rgb=decode_image(path.read_bytes(),st);bgr=cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR);dets=app._detect_rows(bgr,tiled=True)
   if not dets:raise RuntimeError('no_face_detected')
   det=max(dets,key=lambda d:float(d[-1])); rec['detection_count']=len(dets);rec['confidence']=float(det[-1])
   aligned=app._align(bgr,det[4:14])
   t=time.perf_counter(); av=app._embedding(aligned,np).astype(np.float32);lat['auraface'].append(time.perf_counter()-t);vectors['auraface'].append(av);rec['auraface']='ok'
  except Exception as e: vectors['auraface'].append(None);fails['auraface'].append({'image':row['image'],'reason':str(e)});rec['auraface']='failed:'+str(e)
  try:
   # OpenCV Zoo SFace reference: FaceRecognizerSF.alignCrop(image, face), then feature().
   face_row=np.asarray(det,dtype=np.float32).reshape(1,-1)
   crop=sface.alignCrop(bgr,face_row)
   t=time.perf_counter();raw=sface.feature(crop).reshape(-1).astype(np.float32);lat['sface'].append(time.perf_counter()-t)
   norm=float(np.linalg.norm(raw));
   if norm<=1e-12:raise RuntimeError('zero_embedding')
   vectors['sface'].append(raw/norm);rec['sface']='ok'
  except Exception as e:vectors['sface'].append(None);fails['sface'].append({'image':row['image'],'reason':str(e)});rec['sface']='failed:'+str(e)
  records.append(rec)
  if ix%20==0 or ix==len(rows):print(f'Processed {ix}/{len(rows)} images',flush=True)
 result={'protocol':{'models':['AuraFace v1 ONNX','OpenCV Zoo SFace 2021dec ONNX'],'provider':'CPU','calibration_and_evaluation':'independent identity splits from supplied manifest','threshold_selection':'maximize calibration F1; evaluated unchanged on evaluation split','pairwise_scores':'dot product of L2-normalized embeddings'},'sample_count':len(rows),'per_image':records,'models':{},'limitations':['Synthetic ControlFace10K does not establish wedding accuracy.','SFace fit/feature timings exclude detection and decode; AuraFace timing is embedding call only.','Benchmark uses existing app YuNet boxes/landmarks for sample selection; SFace uses its required OpenCV alignCrop path.','No independent commercial legal review is represented by this benchmark.']}
 for name in vectors:
  all_scores={};all_labels={};cal_s=[];cal_y=[];eval_s=[];eval_y=[]
  # pair by split
  for split_name in ('calibration','evaluation'):
   ixes=[i for i,r in enumerate(rows) if r['split']==split_name];ss=[];yy=[]
   for ai,i in enumerate(ixes):
    for j in ixes[ai+1:]:
     if vectors[name][i] is None or vectors[name][j] is None:continue
     ss.append(float(np.dot(vectors[name][i],vectors[name][j])));yy.append(rows[i]['identity']==rows[j]['identity'])
   if split_name=='calibration':cal_s,cal_y=ss,yy
   else:eval_s,eval_y=ss,yy
  candidates=np.unique(np.asarray(cal_s)) if cal_s else []
  th=max(candidates,key=lambda t:metrics(cal_s,cal_y,float(t))['f1']) if len(candidates) else 1.1
  auc,eer=auc_eer(eval_s,eval_y) if eval_s else (None,None)
  m=metrics(eval_s,eval_y,float(th)) if eval_s else {}
  result['models'][name]={'failed_embedding_count':len(fails[name]),'failures':fails[name],'calibration_pair_count':len(cal_s),'evaluation_pair_count':len(eval_s),'calibration_threshold':float(th),'evaluation':m,'roc_auc':auc,'eer':eer,'latency_seconds':{'mean':statistics.mean(lat[name]) if lat[name] else None,'p95':float(np.percentile(lat[name],95)) if lat[name] else None,'measured_embedding_fps':len(lat[name])/sum(lat[name]) if lat[name] and sum(lat[name]) else None},'embedding_vectors':{rows[i]['image']:vectors[name][i].tolist() for i in range(len(rows)) if vectors[name][i] is not None}}
 a.output.parent.mkdir(parents=True,exist_ok=True);a.output.write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps({k:{'failed_embedding_count':v['failed_embedding_count'],'calibration_threshold':v['calibration_threshold'],'evaluation':v['evaluation'],'roc_auc':v['roc_auc'],'eer':v['eer'],'latency_seconds':v['latency_seconds']} for k,v in result['models'].items()},indent=2),flush=True)
if __name__=='__main__':main()
