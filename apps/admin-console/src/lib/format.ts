export function money(minor: number, currency = "GHS") {
  const v = minor / 100;
  try {
    return new Intl.NumberFormat("en-GH", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${currency} ${v.toFixed(2)}`;
  }
}

export function pct(n: number, digits = 1) {
  return `${n.toFixed(digits)}%`;
}

export function shortTime(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function platformLabel(p: string) {
  switch (p) {
    case "ios":
      return "iOS";
    case "android":
      return "Android";
    case "pwa_desktop":
      return "PWA Desktop";
    case "web":
      return "Mobile Web";
    default:
      return p;
  }
}
