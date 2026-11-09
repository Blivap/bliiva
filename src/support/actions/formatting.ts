export function formatKobo(amountKobo: number, currency = 'NGN'): string {
  const major = amountKobo / 100;
  return `${currency} ${major.toLocaleString('en-NG', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function shortId(id: string): string {
  return id.length <= 8 ? id : `…${id.slice(-6)}`;
}

export function formatWhen(value?: string | null): string {
  if (!value) return 'not scheduled';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function yesNo(value: boolean): string {
  return value ? 'yes' : 'no';
}
