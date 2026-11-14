import * as React from 'react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
  suffix?: string;
}

/** Campo com rótulo, sufixo de unidade e mensagem de erro acessível */
export function Field({ label, error, hint, suffix, id, className, ...props }: FieldProps) {
  const autoId = React.useId();
  const fieldId = id ?? autoId;
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="relative">
        <Input id={fieldId} aria-invalid={!!error} aria-describedby={error ? fieldId + '-err' : undefined} className={suffix ? 'pr-14' : ''} {...props} />
        {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
      {error ? (
        <p id={fieldId + '-err'} className="text-xs font-medium text-destructive" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}
