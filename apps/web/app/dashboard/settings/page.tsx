export default function StudioSettingsPage() {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.2em] text-gold">Studio</p>
      <h2 className="mt-2 font-serif text-4xl">Settings</h2>
      <div className="mt-7 rounded-xl border bg-white p-6">
        <h3 className="font-serif text-2xl">Studio configuration</h3>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Studio account and platform-wide configuration remain managed by the Super Admin workflow.
          Event-specific access, download, PIN, and retention controls are available inside each
          event workspace.
        </p>
      </div>
    </div>
  );
}
