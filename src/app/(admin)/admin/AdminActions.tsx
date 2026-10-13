'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ActionLabels {
  approve: string;
  resend: string;
  done: string;
  error: string;
  verify: string;
  complete: string;
}

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (url: string, ok: string, fail: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      setMsg(res.ok ? ok : fail);
      if (res.ok) router.refresh();
    } catch {
      setMsg(fail);
    } finally {
      setBusy(false);
    }
  };
  return { busy, msg, run };
}

export function LeadActions({ id, status, approved, labels }: { id: string; status: string; approved: boolean; labels: ActionLabels }) {
  const { busy, msg, run } = useAction();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!approved && status !== 'awaiting_payment' ? (
        <Button size="sm" loading={busy} onClick={() => run(`/api/admin/leads/${id}/approve`, labels.done, labels.error)} data-testid={`approve-${id}`}>
          {labels.approve}
        </Button>
      ) : null}
      {approved ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => run(`/api/admin/leads/${id}/resend`, labels.done, labels.error)} data-testid={`resend-${id}`}>
          {labels.resend}
        </Button>
      ) : null}
      {msg ? (
        <span role="status" className="text-sm">
          {msg}
        </span>
      ) : null}
    </div>
  );
}

export function PrivacyActions({ id, type, verified, completed, labels }: { id: string; type: string; verified: boolean; completed: boolean; labels: ActionLabels }) {
  const { busy, msg, run } = useAction();
  if (completed) return <span className="text-sm text-muted">{labels.done}</span>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!verified ? (
        <Button size="sm" variant="secondary" loading={busy} onClick={() => run(`/api/admin/privacy-requests/${id}/verify`, labels.done, labels.error)}>
          {labels.verify}
        </Button>
      ) : (
        <>
          {type === 'access' || type === 'portability' ? (
            <Button asChild size="sm" variant="secondary">
              <a href={`/api/admin/privacy-requests/${id}/export`}>JSON</a>
            </Button>
          ) : null}
          <Button size="sm" variant="danger" loading={busy} onClick={() => run(`/api/admin/privacy-requests/${id}/complete`, labels.done, labels.error)}>
            {type === 'deletion' ? labels.complete : labels.done}
          </Button>
        </>
      )}
      {msg ? <span role="status" className="text-sm">{msg}</span> : null}
    </div>
  );
}
