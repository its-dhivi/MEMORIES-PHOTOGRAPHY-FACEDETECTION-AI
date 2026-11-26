'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function EventTabs({ eventId }: { eventId: string }) {
  const pathname = usePathname();
  const tabs = [
    { label: 'Overview', href: `/dashboard/events/${eventId}` },
    { label: 'Photographs', href: `/dashboard/events/${eventId}/photos` },
    { label: 'Uploads', href: `/dashboard/events/${eventId}/photos#uploads` },
    { label: 'QR Code', href: `/dashboard/events/${eventId}/qr` },
    { label: 'Settings', href: `/dashboard/events/${eventId}/settings` },
  ];
  return (
    <nav
      className="flex gap-7 overflow-x-auto border-b border-[#ded8cf]"
      aria-label="Event workspace"
    >
      {tabs.map((tab) => {
        const active = tab.href.endsWith(eventId)
          ? pathname === tab.href
          : pathname.startsWith(tab.href.split('#')[0] ?? tab.href);
        return (
          <Link
            key={tab.label}
            href={tab.href}
            className={`whitespace-nowrap border-b-2 px-0 py-4 text-sm ${active ? 'border-[#252522] font-medium text-[#252522]' : 'border-transparent text-[#8b867f] hover:text-[#252522]'}`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
