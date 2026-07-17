import { Landmark, Wallet } from "lucide-react";
import hdfcUrl from "@/assets/hdfc.jpg";
import kvbUrl from "@/assets/kvb.jpg";
import canaraUrl from "@/assets/canara.jpg";

type Bank = "hdfc" | "kvb" | "canara" | "sbi" | "icici" | "axis" | "other" | "cash";

const labels: Record<Bank, string> = {
  hdfc: "HDFC",
  kvb: "KVB",
  canara: "CNB",
  sbi: "SBI",
  icici: "ICICI",
  axis: "AXIS",
  other: "BNK",
  cash: "₹",
};

const LOGOS: Partial<Record<Bank, { url: string; bg: string }>> = {
  hdfc: { url: hdfcUrl, bg: "#ffffff" },
  kvb: { url: kvbUrl, bg: "#FFF9B0" },
  canara: { url: canaraUrl, bg: "#ffffff" },
};

export function BankBadge({
  bank,
  color = "#00CFFF",
  size = 40,
}: {
  bank: Bank;
  color?: string;
  size?: number;
}) {
  const logo = LOGOS[bank];
  if (logo) {
    return (
      <div
        className="grid shrink-0 place-items-center overflow-hidden rounded-full shadow-md ring-2 ring-white/70 transition-transform duration-200 hover:scale-105"
        style={{ width: size, height: size, background: logo.bg }}
        aria-label={`${labels[bank]} account logo`}
      >
        <img
          src={logo.url}
          alt={`${labels[bank]} logo`}
          className="h-full w-full object-contain p-1"
          loading="lazy"
        />
      </div>
    );
  }

  const isCash = bank === "cash";
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-bold text-white shadow-md ring-2 ring-white/60 transition-transform duration-200 hover:scale-105"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}, ${color}cc)`,
        fontSize: size * 0.32,
      }}
      aria-label={`${labels[bank]} account`}
    >
      {isCash ? <Wallet size={size * 0.5} /> : bank === "other" ? <Landmark size={size * 0.5} /> : labels[bank]}
    </div>
  );
}
