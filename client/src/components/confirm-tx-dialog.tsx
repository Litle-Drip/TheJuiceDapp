import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Loader2 } from 'lucide-react';

export interface TxConfirmLine {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}

interface ConfirmTxDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  lines: TxConfirmLine[];
  confirmLabel?: string;
  gas?: { gasEth: number; gasUsd: number } | null;
}

export function ConfirmTxDialog({ open, onClose, onConfirm, title, lines, confirmLabel, gas }: ConfirmTxDialogProps) {
  const [confirming, setConfirming] = useState(false);

  if (!open) return null;

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
      setConfirming(false);
      onClose();
    } catch {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" data-testid="confirm-tx-dialog">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={confirming ? undefined : onClose} />
      <div className="relative bg-card border border-border rounded-md w-full max-w-sm mx-4 p-5 shadow-lg">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-bold">{title}</h3>
        </div>

        <div className="space-y-2 mb-4">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`text-xs ${line.muted ? 'text-muted-foreground' : 'text-foreground'}`}>{line.label}</span>
              <span className={`text-xs font-mono text-right ${line.highlight ? 'font-bold text-yes' : line.muted ? 'text-muted-foreground' : 'font-medium'}`}>
                {line.value}
              </span>
            </div>
          ))}
        </div>

        {gas && (
          <div className="flex items-center justify-center gap-1.5 mb-4 text-[10px] text-muted-foreground">
            <span>Est. gas: {gas.gasEth.toFixed(6)} ETH</span>
            <span className="text-yes">(${gas.gasUsd.toFixed(4)})</span>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center mb-4">
          This will send a transaction to the blockchain. Make sure you've reviewed the details above.
        </p>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={confirming} data-testid="button-cancel-tx">
            Cancel
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={confirming} data-testid="button-confirm-tx">
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
            {confirmLabel || 'Confirm'}
          </Button>
        </div>
      </div>
    </div>
  );
}
