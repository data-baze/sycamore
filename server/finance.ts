export function moneyToMinor(value: string | number): number {
  const text = String(value).trim();
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) {
    throw new Error(`Invalid monetary value: ${value}`);
  }

  const amountMinor = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (amountMinor > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`Invalid monetary value: ${value}`);
  }
  return Number(amountMinor);
}

export function minorToMoney(amountMinor: number): string {
  if (!Number.isSafeInteger(amountMinor)) {
    throw new Error(`Invalid minor-unit amount: ${amountMinor}`);
  }

  const amount = BigInt(amountMinor);
  const absoluteAmount = amount < 0n ? -amount : amount;
  const naira = Number(absoluteAmount / 100n);
  const kobo = String(absoluteAmount % 100n).padStart(2, '0');
  const formattedNaira = new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0
  }).format(naira);

  return `${amount < 0n ? '-' : ''}${formattedNaira}.${kobo}`;
}
