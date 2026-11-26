"""Run YuNet and compare app alignment with an independent five-point reference."""
import argparse, base64, csv, json
from pathlib import Path
import cv2, numpy as np
from app.config import get_settings
from app.image_processor import decode_image
from app.model_manager import ModelManager

TEMPLATE=np.array([[38.2946,51.6963],[73.5318,51.5014],[56.0252,71.7366],[41.5493,92.3655],[70.7299,92.2041]],dtype=np.float32)

def independent_similarity_align(bgr, landmarks, size=112):
    # Independent Umeyama/SVD similarity transform, using YuNet order LE,RE,nose,LM,RM.
    src=np.asarray(landmarks,dtype=np.float64).reshape(5,2)
    dst=TEMPLATE.astype(np.float64)
    sm=src.mean(axis=0); dm=dst.mean(axis=0)
    xs=src-sm; yd=dst-dm
    cov=yd.T@xs/len(src)
    u,s,vt=np.linalg.svd(cov)
    sign=np.eye(2); sign[-1,-1]=np.linalg.det(u@vt)
    rot=u@sign@vt
    var=float(np.sum(xs*xs)/len(src))
    scale=float(np.sum(s*np.diag(sign))/var)
    trans=dm-scale*rot@sm
    matrix=np.column_stack((scale*rot,trans)).astype(np.float32)
    return cv2.warpAffine(bgr,matrix,(size,size),flags=cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT),matrix

def data_url(image):
    ok,buf=cv2.imencode('.jpg',image,[cv2.IMWRITE_JPEG_QUALITY,82])
    return 'data:image/jpeg;base64,'+base64.b64encode(buf).decode() if ok else ''

def main():
    p=argparse.ArgumentParser();p.add_argument('root',type=Path);p.add_argument('manifest',type=Path);p.add_argument('--detection-out',type=Path,required=True);p.add_argument('--alignment-out',type=Path,required=True);p.add_argument('--html-out',type=Path,required=True);p.add_argument('--compare-count',type=int,default=20);a=p.parse_args()
    settings=get_settings();mgr=ModelManager(settings);mgr.load()
    if not mgr.ready: raise SystemExit(f'model load failed: {mgr.error}')
    with a.manifest.open(newline='',encoding='utf-8-sig') as f: manifest=list(csv.DictReader(f))
    diagnostics=[]; chosen=[]
    for i,item in enumerate(manifest,1):
        path=a.root/item['image']; row={'image':item['image'],'identity':item['identity'],'split':item['split'],'detected_faces':0,'detections':[],'selected_face_index':None,'alignment':'not_attempted','embedding':'not_attempted'}
        try:
            rgb=decode_image(path.read_bytes(),settings); bgr=cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR); dets=mgr._detect_rows(bgr,tiled=True); row['detected_faces']=len(dets)
            for j,d in enumerate(dets):
                x,y,w,h=map(float,d[:4]); lm=np.asarray(d[4:14],dtype=float).reshape(5,2)
                row['detections'].append({'index':j,'confidence':float(d[-1]),'bbox_xywh':[x,y,w,h],'landmarks_yunet_order':lm.tolist()})
            if dets:
                sel=max(range(len(dets)),key=lambda j:float(dets[j][-1]));row['selected_face_index']=sel;d=dets[sel]
                aligned=mgr._align(bgr,d[4:14]); row['alignment']='success'
                faces=mgr.analyze(rgb,tiled=True).faces; accepted=[f for f in faces if f.embedding is not None]
                row['embedding']='success' if accepted else 'failure:no_accepted_embedding'
                row['accepted_embeddings']=len(accepted)
                if len(chosen)<a.compare_count:
                    ref,matrix=independent_similarity_align(bgr,d[4:14],mgr.input_width)
                    diff=np.abs(aligned.astype(np.int16)-ref.astype(np.int16))
                    chosen.append({'image':item['image'],'identity':item['identity'],'bbox_xywh':[float(v) for v in d[:4]],'landmarks':np.asarray(d[4:14]).reshape(5,2).tolist(),'existing_matrix':cv2.estimateAffinePartial2D(np.asarray(d[4:14],np.float32).reshape(5,2),TEMPLATE,method=cv2.LMEDS)[0].tolist(),'reference_matrix':matrix.tolist(),'pixel_mae':float(diff.mean()),'pixel_max_abs':int(diff.max()),'pixel_exact_match_fraction':float(np.mean(diff==0)),'original_data_url':data_url(bgr),'existing_aligned_data_url':data_url(aligned),'reference_aligned_data_url':data_url(ref)})
        except Exception as e: row['error']=f'{type(e).__name__}: {e}';row['alignment']='failure';row['embedding']='failure'
        diagnostics.append(row)
        print(f"Processed {i}/{len(manifest)} faces={row['detected_faces']} align={row['alignment']} embed={row['embedding']}",flush=True)
    a.detection_out.parent.mkdir(parents=True,exist_ok=True)
    counts={'images':len(diagnostics),'zero_detection':sum(x['detected_faces']==0 for x in diagnostics),'multiple_detection':sum(x['detected_faces']>1 for x in diagnostics),'alignment_failures':sum(x['alignment']=='failure' for x in diagnostics),'embedding_failures':sum(x['embedding'].startswith('failure') for x in diagnostics)}
    a.detection_out.write_text(json.dumps({'summary':counts,'images':diagnostics},indent=2),encoding='utf-8')
    align_summary={'method':'app: OpenCV estimateAffinePartial2D with LMEDS; independent: Umeyama/SVD similarity transform; same YuNet landmarks and InsightFace 112 template','landmark_order':'YuNet: right eye, left eye, nose tip, right mouth corner, left mouth corner (image-space ordering per OpenCV FaceDetectorYN output)','template':TEMPLATE.tolist(),'image_count':len(chosen),'mean_pixel_mae':float(np.mean([x['pixel_mae'] for x in chosen])) if chosen else None,'max_pixel_mae':max((x['pixel_mae'] for x in chosen),default=None),'max_pixel_abs':max((x['pixel_max_abs'] for x in chosen),default=None),'images':chosen}
    a.alignment_out.write_text(json.dumps(align_summary,indent=2),encoding='utf-8')
    cards=[]
    for x in chosen:
        figures = "".join('<figure><img src="{}"><figcaption>{}</figcaption></figure>'.format(x[k], label) for k,label in [('original_data_url','Original'),('existing_aligned_data_url','App aligned'),('reference_aligned_data_url','Reference aligned')])
        cards.append(f"<article><h3>{x['image']}</h3><p>{x['identity']} ï¿½ MAE {x['pixel_mae']:.3f}, max {x['pixel_max_abs']}</p><div>{figures}</div></article>")
    html='<!doctype html><meta charset="utf-8"><title>Phase 5.1D alignment comparison</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:24px}article{border-bottom:1px solid #555;padding:16px}article div{display:flex;gap:12px}figure{margin:0}img{width:224px;height:224px;object-fit:contain;background:#222}figcaption{padding:5px}</style><h1>Alignment comparison (20 samples)</h1>'+''.join(cards)
    a.html_out.write_text(html,encoding='utf-8')
    print(json.dumps({'detection_summary':counts,'alignment_summary':{k:v for k,v in align_summary.items() if k!='images'},'outputs':[str(a.detection_out),str(a.alignment_out),str(a.html_out)]},indent=2),flush=True)
if __name__=='__main__':main()
