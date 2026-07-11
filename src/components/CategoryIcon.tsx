import {
  Bike, Book, BookOpen, Building2, Coffee, Cookie, Crown, Folder, GraduationCap,
  Landmark, Library, Megaphone, MoreHorizontal, Package, PencilRuler, Receipt,
  School, Smartphone, Sparkles, University, User, Utensils, Wallet, ArrowLeftRight,
  type LucideIcon,
} from "lucide-react";

const MAP: Record<string, LucideIcon> = {
  bike: Bike,
  book: Book,
  books: Library,
  "book-open": BookOpen,
  "building-2": Building2,
  coffee: Coffee,
  cookie: Cookie,
  crown: Crown,
  folder: Folder,
  "graduation-cap": GraduationCap,
  landmark: Landmark,
  library: Library,
  megaphone: Megaphone,
  "more-horizontal": MoreHorizontal,
  package: Package,
  "pencil-ruler": PencilRuler,
  receipt: Receipt,
  school: School,
  smartphone: Smartphone,
  sparkles: Sparkles,
  university: University,
  user: User,
  utensils: Utensils,
  wallet: Wallet,
  transfer: ArrowLeftRight,
};

export function CategoryIcon({
  name,
  color = "#00CFFF",
  size = 36,
  title,
}: {
  name?: string | null;
  color?: string;
  size?: number;
  title?: string;
}) {
  const Icon = (name && MAP[name]) || Folder;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full ring-1 ring-white/50 transition-all duration-200 hover:scale-110 hover:shadow-md"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${color}26, ${color}40)`,
        color,
      }}
      title={title ?? undefined}
      aria-label={title ?? name ?? "category"}
    >
      <Icon size={size * 0.5} strokeWidth={2.2} />
    </div>
  );
}

// Branch-specific icon: each branch gets a distinct building icon + color
const BRANCH_MAP: Record<string, { icon: LucideIcon; color: string }> = {
  VDS: { icon: Building2, color: "#00CFFF" },
  NGC: { icon: School, color: "#00D4C4" },
  CLC: { icon: University, color: "#6366F1" },
  SCH: { icon: GraduationCap, color: "#00D4C4" },
  OTH: { icon: Folder, color: "#6B7280" },
};

export function BranchIcon({
  code,
  size = 28,
  title,
}: {
  code?: string | null;
  size?: number;
  title?: string;
}) {
  const cfg = (code && BRANCH_MAP[code]) || { icon: Landmark, color: "#00CFFF" };
  const Icon = cfg.icon;
  return (
    <div
      className="grid shrink-0 place-items-center rounded-lg ring-1 ring-white/50 transition-all duration-200 hover:scale-110"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${cfg.color}22, ${cfg.color}40)`,
        color: cfg.color,
      }}
      title={title ?? code ?? undefined}
      aria-label={title ?? code ?? "branch"}
    >
      <Icon size={size * 0.55} strokeWidth={2.2} />
    </div>
  );
}
