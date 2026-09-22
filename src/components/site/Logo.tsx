import { Link } from "@tanstack/react-router";
import elev8Logo from "@/assets/elev8-logo.png.asset.json";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link
      to="/"
      className={`flex items-center ${className}`}
      aria-label="Elev8 Services California — home"
    >
      <img
        src={elev8Logo.url}
        alt="Elev8 Services logo"
        className="h-12 w-auto object-contain lg:h-[118px] lg:w-[220px]"
      />
    </Link>
  );
}
