/**
 * Enterprise line icons — crisp 1.5–1.75 stroke, NASA / HUD / fintech serious.
 * No emoji. No filled cartoon glyphs.
 */
import Svg, { Circle, Path, Rect, Line, Polyline, type SvgProps } from "react-native-svg";
import { useTheme } from "../../lib/theme-context";

export type IconName =
  | "send"
  | "receive"
  | "qr"
  | "globe"
  | "cashout"
  | "bolt"
  | "phone"
  | "merchant"
  | "home"
  | "bell"
  | "user"
  | "shield"
  | "card"
  | "wallet"
  | "chart"
  | "exchange"
  | "settings"
  | "lock"
  | "freeze"
  | "support"
  | "accessibility"
  | "family"
  | "insights"
  | "credit"
  | "insurance"
  | "chevron"
  | "check"
  | "close"
  | "mic"
  | "micOff"
  | "eye"
  | "eyeOff"
  | "arrowUpRight"
  | "arrowDownLeft"
  | "arrowLeft"
  | "menu"
  | "building"
  | "atm"
  | "scan"
  | "link"
  | "passkey"
  | "spark"
  | "water"
  | "tv"
  | "wifi"
  | "school"
  | "bus"
  | "refresh"
  | "chat"
  | "call"
  | "video"
  | "ticket"
  | "at"
  | "more"
  | "contact"
  | "type"
  | "contrast"
  | "haptic"
  | "book"
  | "clock"
  | "droplet"
  | "receipt"
  | "split"
  | "refund"
  | "bank"
  | "momo"
  | "alert"
  | "info"
  | "scale"
  | "device";

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  /** Use mood tube colour */
  tube?: boolean;
} & Omit<SvgProps, "width" | "height" | "color">;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.65,
  tube,
  ...rest
}: Props) {
  const { colors, mood } = useTheme();
  const c = color ?? (tube ? mood.tube : colors.text);
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none" as const,
    ...rest,
  };
  const s = {
    stroke: c,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  switch (name) {
    case "send":
    case "arrowUpRight":
      return (
        <Svg {...common}>
          <Path d="M7 17L17 7" {...s} />
          <Path d="M8 7h9v9" {...s} />
        </Svg>
      );
    case "receive":
    case "arrowDownLeft":
      return (
        <Svg {...common}>
          <Path d="M17 7L7 17" {...s} />
          <Path d="M16 17H7v-9" {...s} />
        </Svg>
      );
    case "arrowLeft":
      return (
        <Svg {...common}>
          <Path d="M19 12H5" {...s} />
          <Path d="M11 6l-6 6 6 6" {...s} />
        </Svg>
      );
    case "menu":
      return (
        <Svg {...common}>
          <Path d="M4 7h16M4 12h16M4 17h16" {...s} />
        </Svg>
      );
    case "qr":
    case "scan":
      return (
        <Svg {...common}>
          <Path d="M4 8V5a1 1 0 0 1 1-1h3" {...s} />
          <Path d="M16 4h3a1 1 0 0 1 1 1v3" {...s} />
          <Path d="M20 16v3a1 1 0 0 1-1 1h-3" {...s} />
          <Path d="M8 20H5a1 1 0 0 1-1-1v-3" {...s} />
          <Rect x="8" y="8" width="3.5" height="3.5" rx="0.5" {...s} />
          <Rect x="12.5" y="8" width="3.5" height="3.5" rx="0.5" {...s} />
          <Rect x="8" y="12.5" width="3.5" height="3.5" rx="0.5" {...s} />
          <Path d="M13 13h1.5v1.5H13zM15.5 15.5H17V17h-1.5z" {...s} />
        </Svg>
      );
    case "globe":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="9" {...s} />
          <Path d="M3 12h18" {...s} />
          <Path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z" {...s} />
        </Svg>
      );
    case "cashout":
    case "home":
      return (
        <Svg {...common}>
          <Path d="M4 11.5L12 4l8 7.5" {...s} />
          <Path d="M6.5 10.5V19a1 1 0 0 0 1 1h3.5v-5h2v5H16.5a1 1 0 0 0 1-1v-8.5" {...s} />
        </Svg>
      );
    case "bolt":
      return (
        <Svg {...common}>
          <Path d="M13 2L5 13h6l-1 9 9-13h-6l0-7z" {...s} />
        </Svg>
      );
    case "phone":
      return (
        <Svg {...common}>
          <Rect x="7.5" y="2.5" width="9" height="19" rx="2.2" {...s} />
          <Path d="M10.5 5h3" {...s} />
          <Path d="M11 18h2" {...s} />
        </Svg>
      );
    case "merchant":
    case "building":
      return (
        <Svg {...common}>
          <Path d="M4 20h16" {...s} />
          <Path d="M6 20V6.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1V20" {...s} />
          <Path d="M13 10h4a1 1 0 0 1 1 1v9" {...s} />
          <Path d="M8.5 9h2M8.5 12.5h2M8.5 16h2M15 14h1.5M15 17h1.5" {...s} />
        </Svg>
      );
    case "atm":
      return (
        <Svg {...common}>
          <Rect x="4" y="3" width="16" height="18" rx="2" {...s} />
          <Rect x="7" y="6" width="10" height="6" rx="1" {...s} />
          <Path d="M8 15h3M13 15h3M8 18h8" {...s} />
        </Svg>
      );
    case "bell":
      return (
        <Svg {...common}>
          <Path d="M6.5 16.5h11" {...s} />
          <Path d="M7 16.5V10a5 5 0 0 1 10 0v6.5" {...s} />
          <Path d="M10 16.5v.8a2 2 0 0 0 4 0v-.8" {...s} />
          <Path d="M12 4v1" {...s} />
        </Svg>
      );
    case "user":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8" r="3.5" {...s} />
          <Path d="M5 19.5c1.2-3.2 3.5-4.8 7-4.8s5.8 1.6 7 4.8" {...s} />
        </Svg>
      );
    case "shield":
      return (
        <Svg {...common}>
          <Path d="M12 3l7 3v5.5c0 4.2-2.7 7.8-7 9.5-4.3-1.7-7-5.3-7-9.5V6l7-3z" {...s} />
          <Path d="M9.5 12l1.8 1.8L14.8 10" {...s} />
        </Svg>
      );
    case "card":
      return (
        <Svg {...common}>
          <Rect x="3" y="6" width="18" height="12" rx="2" {...s} />
          <Path d="M3 10h18" {...s} />
          <Path d="M7 14.5h4" {...s} />
        </Svg>
      );
    case "wallet":
      return (
        <Svg {...common}>
          <Path d="M4 7.5A1.5 1.5 0 0 1 5.5 6H18a1 1 0 0 1 1 1v1" {...s} />
          <Rect x="3" y="8" width="18" height="11" rx="2" {...s} />
          <Path d="M15 13.5h3.5" {...s} />
        </Svg>
      );
    case "chart":
      return (
        <Svg {...common}>
          <Path d="M4 19h16" {...s} />
          <Path d="M7 16V11" {...s} />
          <Path d="M12 16V7" {...s} />
          <Path d="M17 16v-4" {...s} />
        </Svg>
      );
    case "exchange":
      return (
        <Svg {...common}>
          <Path d="M7 7h11l-2.5-2.5" {...s} />
          <Path d="M17 17H6l2.5 2.5" {...s} />
          <Path d="M18 7v4M6 17v-4" {...s} />
        </Svg>
      );
    case "settings":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3" {...s} />
          <Path
            d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4l1.4-1.4M17 7l1.4-1.4"
            {...s}
          />
        </Svg>
      );
    case "lock":
    case "passkey":
      return (
        <Svg {...common}>
          <Rect x="6" y="11" width="12" height="9" rx="2" {...s} />
          <Path d="M9 11V8a3 3 0 0 1 6 0v3" {...s} />
          <Path d="M12 14.5v2" {...s} />
        </Svg>
      );
    case "freeze":
      return (
        <Svg {...common}>
          <Path d="M12 3v18" {...s} />
          <Path d="M5 7.5l14 9" {...s} />
          <Path d="M19 7.5l-14 9" {...s} />
          <Path d="M8 5l4 2 4-2M8 19l4-2 4 2" {...s} />
        </Svg>
      );
    case "support":
      return (
        <Svg {...common}>
          <Path d="M5 13v-1a7 7 0 0 1 14 0v1" {...s} />
          <Path d="M5 13a2 2 0 0 0-2 2v1a2 2 0 0 0 2 2h1v-5H5z" {...s} />
          <Path d="M19 13h-1v5h1a2 2 0 0 0 2-2v-1a2 2 0 0 0-2-2z" {...s} />
          <Path d="M15 20h-2a1 1 0 0 1-1-1v-1" {...s} />
        </Svg>
      );
    case "accessibility":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="5" r="2" {...s} />
          <Path d="M6 9h12" {...s} />
          <Path d="M12 9v5l-3.5 7" {...s} />
          <Path d="M12 14l3.5 7" {...s} />
        </Svg>
      );
    case "family":
      return (
        <Svg {...common}>
          <Circle cx="8" cy="8" r="2.2" {...s} />
          <Circle cx="16" cy="8.5" r="1.8" {...s} />
          <Path d="M4.5 18c.6-2.4 2-3.6 3.5-3.6S11 15.6 11.6 18" {...s} />
          <Path d="M13 18c.4-1.8 1.5-2.8 3-2.8s2.6 1 3 2.8" {...s} />
        </Svg>
      );
    case "insights":
      return (
        <Svg {...common}>
          <Path d="M4 18L9 11l3.5 4L16 9l4 9" {...s} />
          <Path d="M14 9h4v4" {...s} />
        </Svg>
      );
    case "credit":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" {...s} />
          <Path d="M12 7.5v9" {...s} />
          <Path d="M9.5 10c.4-1 1.3-1.5 2.5-1.5 1.4 0 2.5.7 2.5 1.9 0 2.4-5 1.4-5 3.8 0 1.1 1 1.9 2.5 1.9 1.2 0 2.1-.5 2.5-1.4" {...s} />
        </Svg>
      );
    case "insurance":
      return (
        <Svg {...common}>
          <Path d="M12 3l7 3v5.5c0 4.2-2.7 7.8-7 9.5-4.3-1.7-7-5.3-7-9.5V6l7-3z" {...s} />
          <Path d="M12 9v4" {...s} />
          <Path d="M12 15.5h.01" {...s} />
        </Svg>
      );
    case "chevron":
      return (
        <Svg {...common}>
          <Path d="M9 6l6 6-6 6" {...s} />
        </Svg>
      );
    case "check":
      return (
        <Svg {...common}>
          <Path d="M5 12.5l4.5 4.5L19 7" {...s} />
        </Svg>
      );
    case "close":
      return (
        <Svg {...common}>
          <Path d="M6 6l12 12M18 6L6 18" {...s} />
        </Svg>
      );
    case "mic":
      return (
        <Svg {...common}>
          <Rect x="9" y="3" width="6" height="11" rx="3" {...s} />
          <Path d="M6 11a6 6 0 0 0 12 0" {...s} />
          <Path d="M12 17v3" {...s} />
        </Svg>
      );
    case "micOff":
      return (
        <Svg {...common}>
          <Path d="M9 9V7a3 3 0 0 1 5.5-1.5" {...s} />
          <Path d="M15 11v1a3 3 0 0 1-5.2 2" {...s} />
          <Path d="M6 11a6 6 0 0 0 9.5 4.8" {...s} />
          <Path d="M12 17v3" {...s} />
          <Path d="M4 4l16 16" {...s} />
        </Svg>
      );
    case "eye":
      return (
        <Svg {...common}>
          <Path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" {...s} />
          <Circle cx="12" cy="12" r="2.5" {...s} />
        </Svg>
      );
    case "eyeOff":
      return (
        <Svg {...common}>
          <Path d="M3 3l18 18" {...s} />
          <Path d="M10.5 10.6A2.5 2.5 0 0 0 13.4 13.5" {...s} />
          <Path d="M6.2 6.4C4 8 2.5 12 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.3 4.2-.8" {...s} />
          <Path d="M14.1 7.2A9.7 9.7 0 0 1 12 5.5c-6 0-9.5 6.5-9.5 6.5" {...s} />
        </Svg>
      );
    case "link":
      return (
        <Svg {...common}>
          <Path d="M10 13a4 4 0 0 0 5.7.3l2-2a4 4 0 0 0-5.7-5.6l-1.1 1.1" {...s} />
          <Path d="M14 11a4 4 0 0 0-5.7-.3l-2 2a4 4 0 0 0 5.7 5.6l1.1-1.1" {...s} />
        </Svg>
      );
    case "spark":
      return (
        <Svg {...common}>
          <Path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" {...s} />
        </Svg>
      );
    case "water":
    case "droplet":
      return (
        <Svg {...common}>
          <Path d="M12 3c0 0-6 7.2-6 11.2a6 6 0 0 0 12 0C18 10.2 12 3 12 3z" {...s} />
        </Svg>
      );
    case "tv":
      return (
        <Svg {...common}>
          <Rect x="3" y="5" width="18" height="12" rx="2" {...s} />
          <Path d="M8 21h8M12 17v4" {...s} />
        </Svg>
      );
    case "wifi":
      return (
        <Svg {...common}>
          <Path d="M5 12.5a9.5 9.5 0 0 1 14 0" {...s} />
          <Path d="M8 15.5a5.5 5.5 0 0 1 8 0" {...s} />
          <Circle cx="12" cy="19" r="1.2" {...s} />
        </Svg>
      );
    case "school":
      return (
        <Svg {...common}>
          <Path d="M3 9.5L12 5l9 4.5-9 4.5L3 9.5z" {...s} />
          <Path d="M7 12v4.5c0 1.5 2.2 2.5 5 2.5s5-1 5-2.5V12" {...s} />
          <Path d="M21 10v6" {...s} />
        </Svg>
      );
    case "bus":
      return (
        <Svg {...common}>
          <Rect x="4" y="4" width="16" height="13" rx="2" {...s} />
          <Path d="M4 11h16M8 17v2M16 17v2M8 14h.01M16 14h.01" {...s} />
        </Svg>
      );
    case "refresh":
      return (
        <Svg {...common}>
          <Path d="M20 12a8 8 0 1 1-2.3-5.6" {...s} />
          <Path d="M20 5v5h-5" {...s} />
        </Svg>
      );
    case "chat":
      return (
        <Svg {...common}>
          <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" {...s} />
        </Svg>
      );
    case "call":
      return (
        <Svg {...common}>
          <Path d="M7 3.5h3l1.5 4-2 1.2a11 11 0 0 0 5.8 5.8l1.2-2 4 1.5v3A2 2 0 0 1 18.5 19 15.5 15.5 0 0 1 5 5.5 2 2 0 0 1 7 3.5z" {...s} />
        </Svg>
      );
    case "video":
      return (
        <Svg {...common}>
          <Rect x="3" y="6" width="12" height="12" rx="2" {...s} />
          <Path d="M15 10.5l6-3.5v10l-6-3.5v-3z" {...s} />
        </Svg>
      );
    case "ticket":
      return (
        <Svg {...common}>
          <Path d="M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" {...s} />
          <Path d="M12 6v12" {...s} />
        </Svg>
      );
    case "at":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="3.2" {...s} />
          <Path d="M16 12v1.2a2.2 2.2 0 0 0 4.2.6A8 8 0 1 1 19 8.5" {...s} />
        </Svg>
      );
    case "more":
      return (
        <Svg {...common}>
          <Circle cx="6" cy="12" r="1.3" {...s} />
          <Circle cx="12" cy="12" r="1.3" {...s} />
          <Circle cx="18" cy="12" r="1.3" {...s} />
        </Svg>
      );
    case "contact":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="8" r="3.5" {...s} />
          <Path d="M5 19.5c1.1-3.4 3.5-5 7-5s5.9 1.6 7 5" {...s} />
        </Svg>
      );
    case "type":
      return (
        <Svg {...common}>
          <Path d="M5 6h14M12 6v12M8 18h8" {...s} />
        </Svg>
      );
    case "contrast":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" {...s} />
          <Path d="M12 3.5v17a8.5 8.5 0 0 0 0-17z" {...s} />
        </Svg>
      );
    case "haptic":
      return (
        <Svg {...common}>
          <Rect x="8" y="3" width="8" height="18" rx="2" {...s} />
          <Path d="M4 9v6M20 9v6M2 11v2M22 11v2" {...s} />
        </Svg>
      );
    case "book":
      return (
        <Svg {...common}>
          <Path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v16H7.5A2.5 2.5 0 0 0 5 21.5V5.5z" {...s} />
          <Path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" {...s} />
        </Svg>
      );
    case "clock":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" {...s} />
          <Path d="M12 7.5V12l3 2" {...s} />
        </Svg>
      );
    case "receipt":
      return (
        <Svg {...common}>
          <Path d="M6 3h12v18l-2-1.4L14 21l-2-1.4L10 21l-2-1.4L6 21V3z" {...s} />
          <Path d="M9 8h6M9 12h6M9 16h4" {...s} />
        </Svg>
      );
    case "split":
      return (
        <Svg {...common}>
          <Path d="M12 3v7" {...s} />
          <Path d="M8 6l4-3 4 3" {...s} />
          <Path d="M5 14l7 7 7-7" {...s} />
          <Path d="M5 14h14" {...s} />
        </Svg>
      );
    case "refund":
      return (
        <Svg {...common}>
          <Path d="M9 14H5v4" {...s} />
          <Path d="M5 14a8 8 0 1 0 2.3-5.6L5 10.5" {...s} />
        </Svg>
      );
    case "bank":
      return (
        <Svg {...common}>
          <Path d="M3 9.5L12 4l9 5.5" {...s} />
          <Path d="M4 10h16" {...s} />
          <Path d="M6 10v7M10 10v7M14 10v7M18 10v7" {...s} />
          <Path d="M4 17h16" {...s} />
          <Path d="M3 20h18" {...s} />
        </Svg>
      );
    case "momo":
      return (
        <Svg {...common}>
          <Rect x="4" y="5" width="16" height="14" rx="2.5" {...s} />
          <Path d="M4 10h16" {...s} />
          <Path d="M8 14h4" {...s} />
          <Circle cx="16" cy="14" r="1.2" {...s} />
        </Svg>
      );
    case "alert":
      return (
        <Svg {...common}>
          <Path d="M12 4l9 16H3L12 4z" {...s} />
          <Path d="M12 10v4M12 16.5h.01" {...s} />
        </Svg>
      );
    case "info":
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8.5" {...s} />
          <Path d="M12 11v5M12 8h.01" {...s} />
        </Svg>
      );
    case "scale":
      return (
        <Svg {...common}>
          <Path d="M12 4v16M5 8h14" {...s} />
          <Path d="M7 8l-3 7h6L7 8zM17 8l-3 7h6l-3-7z" {...s} />
        </Svg>
      );
    case "device":
      return (
        <Svg {...common}>
          <Rect x="7" y="2.5" width="10" height="19" rx="2" {...s} />
          <Path d="M11 17.5h2" {...s} />
        </Svg>
      );
    default:
      return (
        <Svg {...common}>
          <Circle cx="12" cy="12" r="8" {...s} />
        </Svg>
      );
  }
}
