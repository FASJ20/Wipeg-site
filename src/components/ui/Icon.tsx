import {
  Award,
  Briefcase,
  Car,
  ChefHat,
  Code2,
  Cpu,
  GraduationCap,
  Languages,
  LineChart,
  Mountain,
  Scale,
  Sprout,
  Stethoscope,
  Wallet,
  type LucideProps,
} from "lucide-react";

const registry = {
  Award,
  Briefcase,
  Car,
  ChefHat,
  Code2,
  Cpu,
  GraduationCap,
  Languages,
  LineChart,
  Mountain,
  Scale,
  Sprout,
  Stethoscope,
  Wallet,
} as const;

export type IconName = keyof typeof registry;

/** Resolves the icon names stored as strings in `src/data/site.ts`. */
export function Icon({ name, ...props }: { name: string } & LucideProps) {
  const Cmp = registry[name as IconName] ?? GraduationCap;
  return <Cmp {...props} />;
}
