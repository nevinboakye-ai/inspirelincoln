import { PortalSkeleton } from "@/components/ui/skeleton";

/**
 * Shown the instant a My Hub link is tapped. Having a loading boundary also
 * lets Next.js prefetch these account pages as soon as their links appear, so
 * the menu and frame are already on the phone before anyone taps.
 */
export default function Loading() {
  return <PortalSkeleton />;
}
