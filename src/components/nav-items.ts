import { LayoutDashboard, PieChart, WalletMinimal, PiggyBank, Wrench } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: any;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/budgets", label: "Budget", icon: PieChart },
  { href: "/transactions", label: "Transactions", icon: WalletMinimal },
  { href: "/goals", label: "Save", icon: PiggyBank },
  { href: "/subscriptions", label: "Tools", icon: Wrench },
];
