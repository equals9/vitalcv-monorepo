'use client';

/**
 * VitalCV — Healthcare Operations Engine (Wave 1400)
 *
 * Ported from the wave1400 Claude Design handoff (standalone React-18 + Babel
 * bundle) into a single self-contained client island. Every `window.X = X`
 * global from the original modules becomes a module-scoped binding here, the
 * hash router runs against the current route's `#hash`, and the accent CSS
 * variables + custom utility classes are scoped under the `.w14` root so the
 * engine's dark theme cannot leak into the app's theme system.
 *
 * The component reads localStorage / Date.now() at module load, so the route
 * mounts it via next/dynamic({ ssr: false }).
 */

import * as React from 'react';
import type { OpsSnapshot } from '@/lib/ops-engine/contract';

// ───────────────────────────── icons ─────────────────────────────
const ic = (paths: React.ReactNode, viewBox = '0 0 24 24') => {
  const IconGlyph = ({ size = 16, className = '', strokeWidth = 1.75, ...rest }: any) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...rest}
    >
      {paths}
    </svg>
  );
  IconGlyph.displayName = 'IconGlyph';
  return IconGlyph;
};

const Icon: Record<string, any> = {
  Check: ic(<polyline points="20 6 9 17 4 12" />),
  CheckCircle: ic(<><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>),
  Clock: ic(<><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" /></>),
  Lock: ic(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>),
  Shield: ic(<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" />),
  ShieldCheck: ic(<><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><polyline points="9 12 11 14 15 10" /></>),
  AlertTri: ic(<><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  X: ic(<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>),
  ArrowRight: ic(<><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></>),
  ArrowUp: ic(<><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>),
  ArrowDown: ic(<><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>),
  ArrowUpRight: ic(<><line x1="7" y1="17" x2="17" y2="7" /><polyline points="7 7 17 7 17 17" /></>),
  Download: ic(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>),
  ChevronDown: ic(<polyline points="6 9 12 15 18 9" />),
  ChevronRight: ic(<polyline points="9 18 15 12 9 6" />),
  ChevronLeft: ic(<polyline points="15 18 9 12 15 6" />),
  Copy: ic(<><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></>),
  Link: ic(<><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>),
  ExternalLink: ic(<><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></>),
  Search: ic(<><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>),
  User: ic(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>),
  Building: ic(<><rect x="3" y="3" width="18" height="18" rx="1" /><line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" /></>),
  Badge: ic(<path d="M12 2 4 6v6c0 5.55 3.84 9.74 8 11 4.16-1.26 8-5.45 8-11V6l-8-4z" />),
  FileText: ic(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="9" y1="13" x2="15" y2="13" /><line x1="9" y1="17" x2="15" y2="17" /></>),
  Activity: ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  Info: ic(<><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="17" /><line x1="12" y1="8" x2="12.01" y2="8" /></>),
  Stamp: ic(<><path d="M5 22h14" /><path d="M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17h16v-1.5c0-.47-.13-.92-.37-1.27z" /><path d="M14 13V8.5a2.5 2.5 0 0 0-5 0V13" /></>),
  Hash: ic(<><line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" /></>),
  Minus: ic(<line x1="5" y1="12" x2="19" y2="12" />),
  Plus: ic(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>),
  MapPin: ic(<><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" /></>),
  Calendar: ic(<><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>),
  Globe: ic(<><circle cx="12" cy="12" r="9" /><line x1="3" y1="12" x2="21" y2="12" /><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" /></>),
  Layers: ic(<><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>),
  Gauge: ic(<><path d="M12 14 7 9" /><path d="M3.69 16.5a9 9 0 1 1 16.62 0" /></>),
  GitBranch: ic(<><line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" /></>),
  Network: ic(<><rect x="9" y="2" width="6" height="6" rx="1" /><rect x="2" y="16" width="6" height="6" rx="1" /><rect x="16" y="16" width="6" height="6" rx="1" /><path d="M5 16v-2a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" /><path d="M12 8v4" /></>),
  Sparkles: ic(<><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" /></>),
  Route: ic(<><circle cx="6" cy="19" r="2.5" /><circle cx="18" cy="5" r="2.5" /><path d="M9 19h6a4 4 0 0 0 4-4 4 4 0 0 1 4-4" /></>),
  Stethoscope: ic(<><path d="M4 3v6a4 4 0 0 0 8 0V3" /><path d="M4 3h2M10 3h2" /><path d="M8 13v3a4 4 0 0 0 8 0v-1" /><circle cx="18" cy="13" r="2.5" /></>),
  Book: ic(<><path d="M4 4v16a2 2 0 0 0 2 2h14V2H6a2 2 0 0 0-2 2z" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="14" y2="10" /></>),
  GraduationCap: ic(<><path d="M22 10 12 5 2 10l10 5 10-5z" /><path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" /></>),
  Award: ic(<><circle cx="12" cy="8" r="6" /><path d="M8.5 13 7 22l5-3 5 3-1.5-9" /></>),
  Microscope: ic(<><path d="M6 18h8M3 22h18M14 22a7 7 0 1 0 0-14h-1" /><path d="M9 14h2M9 12a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2z" /></>),
  Briefcase: ic(<><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>),
  Users: ic(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>),
  TrendingUp: ic(<><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>),
  Target: ic(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>),
  Flag: ic(<><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></>),
  Compass: ic(<><circle cx="12" cy="12" r="9" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" /></>),
  Anchor: ic(<><circle cx="12" cy="5" r="3" /><line x1="12" y1="22" x2="12" y2="8" /><path d="M5 12H2a10 10 0 0 0 20 0h-3" /></>),
  Pulse: ic(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />),
  Dot: ic(<circle cx="12" cy="12" r="3.5" />),
  Heart: ic(<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />),
  Mail: ic(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></>),
  Send: ic(<><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>),
  Star: ic(<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />),
  Bookmark: ic(<path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />),
  Zap: ic(<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />),
  Bell: ic(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>),
  Inbox: ic(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>),
  Eye: ic(<><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>),
  Handshake: ic(<><path d="m11 17 2 2a1 1 0 1 0 3-3" /><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" /><path d="m21 3 1 11h-2" /><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" /><path d="M3 4h8" /></>),
  Quote: ic(<><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" /><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" /></>),
  Trophy: ic(<><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></>),
  Scale: ic(<><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z" /><path d="M7 21h10" /><path d="M12 3v18" /><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2" /></>),
  Lightbulb: ic(<><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5" /><path d="M9 18h6" /><path d="M10 22h4" /></>),
  Mountain: ic(<path d="m8 3 4 8 5-5 5 15H2L8 3z" />),
  Megaphone: ic(<><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" /></>),
  Repeat: ic(<><path d="m17 2 4 4-4 4" /><path d="M3 11v-1a4 4 0 0 1 4-4h14" /><path d="m7 22-4-4 4-4" /><path d="M21 13v1a4 4 0 0 1-4 4H3" /></>),
  PlayCircle: ic(<><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></>),
  Filter: ic(<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />),
  Share2: ic(<><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" /></>),
  Crosshair: ic(<><circle cx="12" cy="12" r="9" /><line x1="22" y1="12" x2="18" y2="12" /><line x1="6" y1="12" x2="2" y2="12" /><line x1="12" y1="6" x2="12" y2="2" /><line x1="12" y1="22" x2="12" y2="18" /></>),
  Maximize: ic(<><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /></>),
  RotateCw: ic(<><path d="M21 12a9 9 0 1 1-3-6.7L21 8" /><polyline points="21 3 21 8 16 8" /></>),
  Fingerprint: ic(<><path d="M2 12C2 6.5 6.5 2 12 2a10 10 0 0 1 8 4" /><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" /><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" /><path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" /><path d="M8.65 22c.21-.66.45-1.32.57-2" /><path d="M14 13.12c0 2.38 0 6.38-1 8.88" /><path d="M2 16h.01" /><path d="M21.8 16c.2-2 .131-5.354 0-6" /><path d="M9 6.8a6 6 0 0 1 9 5.2v2" /></>),
  HelpCircle: ic(<><circle cx="12" cy="12" r="9" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></>),
  Move: ic(<><polyline points="5 9 2 12 5 15" /><polyline points="9 5 12 2 15 5" /><polyline points="15 19 12 22 9 19" /><polyline points="19 9 22 12 19 15" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" /></>),
  Atom: ic(<><circle cx="12" cy="12" r="1.5" /><path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9-4.54-4.52-9.87-6.54-11.9-4.5-2.04 2.03-.02 7.36 4.5 11.9 4.54 4.52 9.87 6.54 11.9 4.5Z" /><path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9-2.03-2.04-7.36-.02-11.9 4.5-4.52 4.54-6.54 9.87-4.5 11.9 2.03 2.04 7.36.02 11.9-4.5Z" /></>),
  Boxes: ic(<><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42Z" /><path d="m7 16.5-4.74-2.85" /><path d="m7 16.5 5-3" /><path d="M7 16.5v5.17" /><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3Z" /><path d="m17 16.5-5-3" /><path d="m17 16.5 4.74-2.85" /><path d="M17 16.5v5.17" /><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8Z" /><path d="M12 8 7.26 5.15" /><path d="m12 8 4.74-2.85" /><path d="M12 13.5V8" /></>),
  Settings: ic(<><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>),
  Sliders: ic(<><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /><line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" /></>),
  Trash: ic(<><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>),
  Pencil: ic(<><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" /></>),
  Grip: ic(<><circle cx="9" cy="6" r="1.4" /><circle cx="15" cy="6" r="1.4" /><circle cx="9" cy="12" r="1.4" /><circle cx="15" cy="12" r="1.4" /><circle cx="9" cy="18" r="1.4" /><circle cx="15" cy="18" r="1.4" /></>),
  Grid: ic(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>),
  Save: ic(<><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></>),
  Unlock: ic(<><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 7.86-1" /></>),
  EyeOff: ic(<><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" /><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" /><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" /><line x1="2" y1="2" x2="22" y2="22" /></>),
  Command: ic(<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />),
  Workflow: ic(<><rect x="3" y="3" width="6" height="6" rx="1" /><rect x="15" y="15" width="6" height="6" rx="1" /><path d="M6 9v6a2 2 0 0 0 2 2h7" /></>),
  Wand: ic(<><path d="m15 4 1 1-9 9-1-1 9-9z" /><path d="M9 11 4 16M3 21l1-1M18 2l1 1M21 6l-1 1M14 7l1 1" /><path d="m6 18 3-3" /></>),
  Toggle: ic(<><rect x="1" y="6" width="22" height="12" rx="6" /><circle cx="16" cy="12" r="3" /></>),
  Plug: ic(<><path d="M12 22v-5M9 8V2M15 8V2M18 8v3a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z" /></>),
  Database: ic(<><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></>),
  ListChecks: ic(<><path d="m3 17 2 2 4-4" /><path d="m3 7 2 2 4-4" /><line x1="13" y1="6" x2="21" y2="6" /><line x1="13" y1="12" x2="21" y2="12" /><line x1="13" y1="18" x2="21" y2="18" /></>),
  Siren: ic(<><path d="M7 18v-6a5 5 0 1 1 10 0v6" /><path d="M5 21a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1 1 1 0 0 0-1 1v1a1 1 0 0 0 1 1z" /><path d="M21 12h1M18.5 4.5 18 5M2 12h1M12 2v1M4.929 4.929l.707.707M12 12v9" /></>),
  Radar: ic(<><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" /><path d="M4 6h.01" /><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" /><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" /><path d="M12 18h.01" /><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" /><circle cx="12" cy="12" r="2" /><path d="m13.41 10.59 5.66-5.66" /></>),
  ChevronsUp: ic(<><path d="m17 11-5-5-5 5" /><path d="m17 18-5-5-5 5" /></>),
  ArrowUpCircle: ic(<><circle cx="12" cy="12" r="10" /><path d="m16 12-4-4-4 4" /><path d="M12 16V8" /></>),
  Pause: ic(<><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></>),
  Play: ic(<polygon points="6 3 20 12 6 21 6 3" />),
  GitCommit: ic(<><circle cx="12" cy="12" r="3" /><line x1="3" y1="12" x2="9" y2="12" /><line x1="15" y1="12" x2="21" y2="12" /></>),
  CornerDownRight: ic(<><polyline points="15 10 20 15 15 20" /><path d="M4 4v7a4 4 0 0 0 4 4h12" /></>),
  UserPlus: ic(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>),
  Hourglass: ic(<><path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" /><path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" /></>),
  ShieldAlert: ic(<><path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /><path d="M12 8v4" /><path d="M12 16h.01" /></>),
  CircleDot: ic(<><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></>),
};

// ───────────────────────────── data model ─────────────────────────────
const DEMO_ROLES: Record<string, any> = {
  recruiter: { id: 'recruiter', label: 'Recruiter', short: 'Recruiting', icon: 'Search', accent: '#6aa8f5' },
  credentialing: { id: 'credentialing', label: 'Credentialing Specialist', short: 'Credentialing', icon: 'ShieldCheck', accent: '#34d8e8' },
  chair: { id: 'chair', label: 'Department Chair', short: 'Department', icon: 'Building', accent: '#c08bf0' },
  mso: { id: 'mso', label: 'Medical Staff Office', short: 'MSO', icon: 'Stamp', accent: '#f0a93a' },
  cmo: { id: 'cmo', label: 'Chief Medical Officer', short: 'Executive', icon: 'Award', accent: '#5ed6a4' },
  program: { id: 'program', label: 'Program Director', short: 'Program', icon: 'GraduationCap', accent: '#6aa8f5' },
  coordinator: { id: 'coordinator', label: 'Staffing Coordinator', short: 'Staffing', icon: 'Users', accent: '#f0a93a' },
  payer_ops: { id: 'payer_ops', label: 'Network Operations', short: 'Network Ops', icon: 'Network', accent: '#ec7a9b' },
};
let ROLES: Record<string, any> = DEMO_ROLES;

const DEMO_TEAM: any[] = [
  { id: 'u1', name: 'Dana Whitfield', role: 'credentialing', initials: 'DW' },
  { id: 'u2', name: 'Marcus Reyes', role: 'recruiter', initials: 'MR' },
  { id: 'u3', name: 'Priya Anand', role: 'mso', initials: 'PA' },
  { id: 'u4', name: 'Sloane Carter', role: 'credentialing', initials: 'SC' },
  { id: 'u5', name: 'Theo Lindqvist', role: 'coordinator', initials: 'TL' },
  { id: 'u6', name: 'Renée Okafor', role: 'cmo', initials: 'RO' },
  { id: 'u7', name: 'Jonah Park', role: 'recruiter', initials: 'JP' },
  { id: 'u8', name: 'Camila Duarte', role: 'payer_ops', initials: 'CD' },
];
let TEAM: any[] = DEMO_TEAM;

const SPECIALTIES = ['Cardiology', 'Emergency Medicine', 'Internal Medicine', 'Pediatrics', 'Anesthesiology', 'Radiology', 'Family Medicine', 'Hospitalist', 'OB-GYN', 'Psychiatry', 'Orthopedics', 'Neurology', 'Oncology', 'Dermatology', 'Pulmonology', 'Nephrology'];

const FIRST = ['Aria', 'Dev', 'Luis', 'Priya', 'Tomás', 'Hana', 'Omar', 'Greta', 'Ivy', 'Noah', 'Zoe', 'Macie', 'Elena', 'Marcus', 'Nadia', 'Caleb', 'Soraya', 'Idris', 'Wren', 'Yusuf', 'Lena', 'Ravi', 'Mira', 'Felix', 'Anaya', 'Diego', 'Phoebe', 'Kian', 'Tessa', 'Amari', 'Bianca', 'Hugo', 'Saanvi', 'Otis', 'Leila', 'Cyrus', 'Vera', 'Mateo', 'Indira', 'Rohan', 'Esme', 'Tariq', 'Juno', 'Selima', 'Bodhi', 'Carys', 'Dmitri', 'Aisha', 'Niko', 'Petra'];
const LAST = ['Miller', 'Patel', 'Chen', 'Romero', 'Nair', 'Vega', 'Sato', 'Haddad', 'Lindqvist', 'Brooks', 'Frank', 'Park', 'Okafor', 'Duarte', 'Reyes', 'Anand', 'Carter', 'Whitfield', 'Sorensen', 'Adebayo', 'Kowalski', 'Nakamura', 'Ferreira', 'Bauer', 'Costa', 'Ibrahim', 'Larsen', 'Petrov', 'Mensah', 'Solberg', 'Rahman', 'Castillo', 'Novak', 'Bell', 'Khan', 'Andersen', 'Mwangi', 'Holt', 'Russo', 'Greene'];

const DEMO_BLOCKERS: any[] = [
  { id: 'b_npi', label: 'NPI mismatch with source registry', sev: 'high' },
  { id: 'b_lic', label: 'State license verification pending', sev: 'high' },
  { id: 'b_dea', label: 'DEA registration not yet returned', sev: 'med' },
  { id: 'b_ref', label: 'Peer reference unresponsive', sev: 'med' },
  { id: 'b_mal', label: 'Malpractice history under review', sev: 'high' },
  { id: 'b_doc', label: 'Missing primary source document', sev: 'med' },
  { id: 'b_gap', label: 'Unexplained gap in work history', sev: 'low' },
  { id: 'b_pay', label: 'Payer enrollment ID not issued', sev: 'med' },
];
let BLOCKERS: any[] = DEMO_BLOCKERS;

const DEMO_WORKSPACES: any[] = [
  {
    id: 'amc', name: 'Northwell Academic Medical Center', type: 'Academic Medical Center',
    accent: '#34d8e8', icon: 'GraduationCap', short: 'AMC',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Department', groupPl: 'Departments' },
    stats: { providers: 1840, groups: 42, active: 1612 },
    groups: ['Cardiology', 'Emergency', 'Internal Medicine', 'Surgery', 'Pediatrics', 'Radiology', 'Anesthesiology', 'Neurology'],
    stages: [
      { id: 's1', label: 'Recruit', owner: 'recruiter', sla: 14 },
      { id: 's2', label: 'Interview', owner: 'chair', sla: 21 },
      { id: 's3', label: 'Evidence Review', owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Credential Readiness', owner: 'credentialing', sla: 30 },
      { id: 's5', label: 'Privileging', owner: 'mso', sla: 14 },
      { id: 's6', label: 'Offer', owner: 'chair', sla: 7 },
      { id: 's7', label: 'Onboarding', owner: 'mso', sla: 21 },
      { id: 's8', label: 'Active', owner: 'cmo', sla: 0 },
    ],
    roleIds: ['recruiter', 'credentialing', 'chair', 'mso', 'cmo'],
  },
  {
    id: 'community', name: 'Cedar Valley Community Hospital', type: 'Community Hospital',
    accent: '#5ed6a4', icon: 'Heart', short: 'CVH',
    terms: { provider: 'Clinician', providerPl: 'Clinicians', group: 'Unit', groupPl: 'Units' },
    stats: { providers: 410, groups: 16, active: 372 },
    groups: ['Med-Surg', 'Emergency', 'ICU', 'Maternity', 'Outpatient', 'Cardiology'],
    stages: [
      { id: 's1', label: 'Refer', owner: 'recruiter', sla: 10 },
      { id: 's2', label: 'Evidence Review', owner: 'credentialing', sla: 14 },
      { id: 's3', label: 'Credential Readiness', owner: 'credentialing', sla: 21 },
      { id: 's4', label: 'Privileging', owner: 'mso', sla: 14 },
      { id: 's5', label: 'Onboarding', owner: 'mso', sla: 14 },
      { id: 's6', label: 'Active', owner: 'cmo', sla: 0 },
    ],
    roleIds: ['credentialing', 'mso', 'chair', 'cmo'],
  },
  {
    id: 'group', name: 'Summit Cardiology Medical Group', type: 'Medical Group',
    accent: '#f0a93a', icon: 'Briefcase', short: 'SCG',
    terms: { provider: 'Provider', providerPl: 'Providers', group: 'Practice', groupPl: 'Practices' },
    stats: { providers: 96, groups: 7, active: 88 },
    groups: ['North Clinic', 'Interventional', 'Electrophysiology', 'Imaging', 'South Clinic'],
    stages: [
      { id: 's1', label: 'Recruit', owner: 'recruiter', sla: 12 },
      { id: 's2', label: 'Offer', owner: 'recruiter', sla: 7 },
      { id: 's3', label: 'Evidence Review', owner: 'credentialing', sla: 10 },
      { id: 's4', label: 'Payer Enrollment', owner: 'payer_ops', sla: 45 },
      { id: 's5', label: 'Onboarding', owner: 'coordinator', sla: 14 },
      { id: 's6', label: 'Active', owner: 'chair', sla: 0 },
    ],
    roleIds: ['recruiter', 'credentialing', 'payer_ops', 'coordinator'],
  },
  {
    id: 'staffing', name: 'Meridian Locums & Staffing', type: 'Staffing Agency',
    accent: '#c08bf0', icon: 'Users', short: 'MLS',
    terms: { provider: 'Candidate', providerPl: 'Candidates', group: 'Client', groupPl: 'Clients' },
    stats: { providers: 2310, groups: 184, active: 640 },
    groups: ['Mercy West', 'St. Anne', 'Valley Health', 'Pinewood', 'Lakeside', 'Harbor General'],
    stages: [
      { id: 's1', label: 'Source', owner: 'recruiter', sla: 5 },
      { id: 's2', label: 'Screen', owner: 'recruiter', sla: 7 },
      { id: 's3', label: 'Evidence Review', owner: 'credentialing', sla: 7 },
      { id: 's4', label: 'Submit to Client', owner: 'coordinator', sla: 3 },
      { id: 's5', label: 'Offer', owner: 'coordinator', sla: 5 },
      { id: 's6', label: 'Credential Readiness', owner: 'credentialing', sla: 14 },
      { id: 's7', label: 'On Assignment', owner: 'coordinator', sla: 0 },
    ],
    roleIds: ['recruiter', 'coordinator', 'credentialing'],
  },
  {
    id: 'residency', name: 'University Hospital Residency', type: 'Residency Program',
    accent: '#6aa8f5', icon: 'GraduationCap', short: 'UHR',
    terms: { provider: 'Resident', providerPl: 'Residents', group: 'Program', groupPl: 'Programs' },
    stats: { providers: 312, groups: 24, active: 288 },
    groups: ['Internal Medicine', 'Surgery', 'Pediatrics', 'Emergency', 'Psychiatry', 'Family Medicine'],
    stages: [
      { id: 's1', label: 'Match', owner: 'program', sla: 0 },
      { id: 's2', label: 'Evidence Review', owner: 'credentialing', sla: 21 },
      { id: 's3', label: 'Onboarding', owner: 'program', sla: 30 },
      { id: 's4', label: 'Active', owner: 'program', sla: 0 },
      { id: 's5', label: 'Milestone Review', owner: 'program', sla: 0 },
      { id: 's6', label: 'Graduation', owner: 'program', sla: 0 },
    ],
    roleIds: ['program', 'credentialing', 'cmo'],
  },
  {
    id: 'payer', name: 'BlueRiver Health Plan', type: 'Payer Network',
    accent: '#ec7a9b', icon: 'Network', short: 'BRH',
    terms: { provider: 'Network Provider', providerPl: 'Network Providers', group: 'Network', groupPl: 'Networks' },
    stats: { providers: 14200, groups: 38, active: 12940 },
    groups: ['Commercial PPO', 'Medicare Advantage', 'Medicaid', 'HMO Gold', 'EPO', 'Tiered Network'],
    stages: [
      { id: 's1', label: 'Application', owner: 'payer_ops', sla: 5 },
      { id: 's2', label: 'Evidence Review', owner: 'credentialing', sla: 30 },
      { id: 's3', label: 'Credential Readiness', owner: 'credentialing', sla: 45 },
      { id: 's4', label: 'Committee Review', owner: 'cmo', sla: 30 },
      { id: 's5', label: 'Directory Listing', owner: 'payer_ops', sla: 7 },
      { id: 's6', label: 'In-Network', owner: 'payer_ops', sla: 0 },
    ],
    roleIds: ['payer_ops', 'credentialing', 'cmo'],
  },
];
let WORKSPACES: any[] = DEMO_WORKSPACES;

// Live-mode flag + data switch. Demo path never touches these; the live root
// calls __loadLive() with a real OpsSnapshot before first render. References to
// WORKSPACES/TEAM/ROLES/BLOCKERS resolve the current binding at call time, so
// the whole engine renders real data without any per-component rewiring.
let LIVE = false;

/* seeded RNG (mulberry32) */
function rng(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rosterSize(ws: any) {
  const inMotion = ws.stats.providers - ws.stats.active;
  return Math.max(24, Math.min(64, Math.round(inMotion * 0.5) + 18));
}

function genRoster(ws: any) {
  const r = rng(hashStr('w1400:' + ws.id));
  const n = rosterSize(ws);
  const lastIdx = ws.stages.length - 1;
  const out: any[] = [];
  for (let i = 0; i < n; i++) {
    const fi = Math.floor(r() * FIRST.length),
      li = Math.floor(r() * LAST.length);
    const name = 'Dr. ' + FIRST[fi] + ' ' + LAST[li];
    let stageIdx;
    const u = r();
    if (u < 0.26) stageIdx = lastIdx;
    else {
      const w = Math.floor(Math.pow(r(), 1.35) * lastIdx);
      stageIdx = Math.min(lastIdx - 1, w);
    }
    const stage = ws.stages[stageIdx];
    const isActive = stageIdx === lastIdx;
    const progress = (stageIdx + (isActive ? 1 : r() * 0.9)) / ws.stages.length;
    let readiness = Math.round(38 + progress * 56 + (r() - 0.5) * 14);
    readiness = Math.max(12, Math.min(100, readiness));
    const sla = stage.sla || 0;
    const daysInStage = sla > 0 ? Math.round(r() * sla * 1.7) : Math.round(r() * 120);
    const overdue = sla > 0 && daysInStage > sla;
    const blockers: string[] = [];
    if (!isActive && r() < (overdue ? 0.62 : 0.24)) {
      const b = BLOCKERS[Math.floor(r() * BLOCKERS.length)];
      blockers.push(b.id);
      if (r() < 0.22) {
        const b2 = BLOCKERS[Math.floor(r() * BLOCKERS.length)];
        if (b2.id !== b.id) blockers.push(b2.id);
      }
    }
    const hasHigh = blockers.some((id) => (BLOCKERS.find((b) => b.id === id) || {}).sev === 'high');
    let risk = 'low';
    if (hasHigh || readiness < 50) risk = 'high';
    else if (blockers.length || overdue || readiness < 72) risk = 'med';
    const licenseDays = isActive ? Math.round(-30 + r() * 400) : null;
    const assignedTo = stage.owner ? TEAM.filter((t) => t.role === stage.owner)[Math.floor(r() * 3)] || TEAM.find((t) => t.role === stage.owner) : null;
    out.push({
      id: ws.id + '-p' + i,
      name,
      specialty: SPECIALTIES[Math.floor(r() * SPECIALTIES.length)],
      group: ws.groups[Math.floor(r() * ws.groups.length)],
      npi: '1' + String(Math.floor(r() * 1e9)).padStart(9, '0'),
      stageIdx,
      isActive,
      readiness,
      risk,
      daysInStage,
      sla,
      overdue,
      blockers,
      licenseDays,
      assignee: assignedTo ? assignedTo.id : null,
      owner: stage.owner,
      flagged: r() < 0.12,
    });
  }
  return out;
}

const QUEUE_DEFS: any[] = [
  {
    id: 'evidence', label: 'Evidence awaiting review', icon: 'FileText', owner: 'credentialing',
    desc: 'Records sitting in an evidence-review stage that need a credentialing decision.',
    match: (p: any, ws: any) => !p.isActive && /evidence/i.test(ws.stages[p.stageIdx].label),
    action: 'Open dossier & verify primary sources',
    impact: 'Unblocks credential readiness for this record',
  },
  {
    id: 'license', label: 'License expiring soon', icon: 'Calendar', owner: 'credentialing',
    desc: 'Active providers whose state license lapses within 90 days.',
    match: (p: any) => p.isActive && p.licenseDays != null && p.licenseDays <= 90,
    action: 'Trigger renewal outreach & request updated license',
    impact: 'Prevents a privileging lapse and lost billable days',
  },
  {
    id: 'recruiting', label: 'Recruiting bottleneck', icon: 'Search', owner: 'recruiter',
    desc: 'Early-stage records past their SLA — the pipeline is stalling at the top.',
    match: (p: any) => p.overdue && p.stageIdx <= 1 && !p.isActive,
    action: 'Re-engage candidate or re-route to another sourcer',
    impact: 'Restores pipeline throughput at the funnel mouth',
  },
  {
    id: 'missing', label: 'Missing documentation', icon: 'AlertTri', owner: 'credentialing',
    desc: 'Records blocked specifically on a missing primary-source document.',
    match: (p: any) => p.blockers.includes('b_doc') || p.blockers.includes('b_gap'),
    action: 'Request document from provider or source registry',
    impact: 'Clears the most common cause of credentialing delay',
  },
  {
    id: 'interviews', label: 'Pending interviews', icon: 'Users', owner: 'chair',
    desc: 'Records waiting on a department interview decision.',
    match: (p: any, ws: any) => !p.isActive && /interview|screen|committee/i.test(ws.stages[p.stageIdx].label),
    action: 'Schedule or record the interview outcome',
    impact: 'Keeps qualified candidates moving toward offer',
  },
  {
    id: 'offers', label: 'Pending offers', icon: 'Send', owner: 'recruiter',
    desc: 'Records in an offer stage awaiting issuance or signature.',
    match: (p: any, ws: any) => !p.isActive && /offer|submit/i.test(ws.stages[p.stageIdx].label),
    action: 'Issue offer or follow up on outstanding signature',
    impact: 'Converts a vetted candidate into committed headcount',
  },
  {
    id: 'blockers', label: 'Credential blockers', icon: 'ShieldAlert', owner: 'credentialing',
    desc: 'Records held by a high-severity verification blocker.',
    match: (p: any) => p.blockers.some((id: string) => (BLOCKERS.find((b) => b.id === id) || {}).sev === 'high'),
    action: 'Resolve the blocking verification or escalate',
    impact: 'Removes the single hardest gate to readiness',
  },
];

const EVENT_TYPES: Record<string, any> = {
  evidence_submitted: { label: 'Evidence submitted', icon: 'FileText', tone: 'slate' },
  verification_done: { label: 'Verification completed', icon: 'ShieldCheck', tone: 'emerald' },
  recruiter_assigned: { label: 'Recruiter assigned', icon: 'UserPlus', tone: 'accent' },
  work_assigned: { label: 'Work assigned', icon: 'UserPlus', tone: 'accent' },
  interview_done: { label: 'Interview completed', icon: 'Users', tone: 'slate' },
  offer_issued: { label: 'Offer issued', icon: 'Send', tone: 'amber' },
  offer_accepted: { label: 'Offer accepted', icon: 'Handshake', tone: 'emerald' },
  evidence_approved: { label: 'Evidence approved', icon: 'CheckCircle', tone: 'emerald' },
  blocker_resolved: { label: 'Blocker resolved', icon: 'Unlock', tone: 'emerald' },
  stage_advanced: { label: 'Advanced to next stage', icon: 'ArrowRight', tone: 'accent' },
  issue_escalated: { label: 'Issue escalated', icon: 'ChevronsUp', tone: 'rose' },
  recognition_updated: { label: 'Recognition updated', icon: 'Award', tone: 'accent' },
  org_notified: { label: 'Organization notified', icon: 'Bell', tone: 'slate' },
  readiness_changed: { label: 'Readiness updated', icon: 'Gauge', tone: 'slate' },
};

// ───────────────────────────── store ─────────────────────────────
const W14_KEY = 'vitalcv.w1400.ops.v3';
let _seq = 1;
const nextSeq = () => _seq++;

function mkEvent({ type, ts, actor, subjectId, subject, group, detail, system }: any) {
  return Object.freeze({
    id: 'e' + nextSeq() + '-' + Math.floor(ts).toString(36),
    seq: _seq,
    ts,
    type,
    actor: actor || null,
    subjectId: subjectId || null,
    subject: subject || null,
    group: group || null,
    detail: detail || '',
    system: !!system,
  });
}

function detailFor(type: string, p: any, ws: any) {
  const stage = ws.stages[p.stageIdx] ? ws.stages[p.stageIdx].label : '—';
  switch (type) {
    case 'evidence_submitted': return `${p.specialty} · primary-source packet received`;
    case 'verification_done': return `License & NPI verified against registry`;
    case 'recruiter_assigned': return `Routed into ${stage}`;
    case 'work_assigned': return `Assigned in ${stage}`;
    case 'interview_done': return `${p.group} panel recorded a decision`;
    case 'offer_issued': return `Offer sent · ${p.specialty}`;
    case 'offer_accepted': return `Signed — onboarding can begin`;
    case 'evidence_approved': return `Readiness conferred by credentialing`;
    case 'blocker_resolved': return `Verification gate cleared`;
    case 'stage_advanced': return `Now in ${stage}`;
    case 'issue_escalated': return `Raised to leadership for attention`;
    case 'recognition_updated': return `Professional Trust profile refreshed`;
    case 'org_notified': return `${ws.short} notified of status change`;
    case 'readiness_changed': return `Readiness now ${p.readiness}%`;
    default: return stage;
  }
}

function seedEvents(ws: any, roster: any[]) {
  const r = rng(hashStr('w1400:ev:' + ws.id));
  const now = Date.now();
  const types = ['evidence_submitted', 'verification_done', 'recruiter_assigned', 'interview_done', 'offer_issued', 'offer_accepted', 'evidence_approved', 'blocker_resolved', 'stage_advanced', 'org_notified', 'recognition_updated'];
  const evs: any[] = [];
  const count = 34;
  for (let i = 0; i < count; i++) {
    const p = roster[Math.floor(r() * roster.length)];
    const t = types[Math.floor(r() * types.length)];
    const ts = now - i * (5 + Math.floor(r() * 9)) * 60000 - Math.floor(r() * 3600000);
    const owner = ws.stages[p.stageIdx] ? ws.stages[p.stageIdx].owner : 'credentialing';
    const actor = (TEAM.filter((usr) => usr.role === owner)[0] || TEAM[Math.floor(r() * TEAM.length)]).id;
    evs.push(mkEvent({ type: t, ts, actor, subjectId: p.id, subject: p.name, group: p.group, detail: detailFor(t, p, ws), system: true }));
  }
  evs.sort((a, b) => b.ts - a.ts);
  return evs;
}

function seedState() {
  const ws: any = {};
  WORKSPACES.forEach((w) => {
    const roster = genRoster(w);
    ws[w.id] = { roster, events: seedEvents(w, roster) };
  });
  return { activeWs: WORKSPACES[0].id, ws, live: true, _v: 3 };
}

function loadState(): any {
  try {
    const raw = localStorage.getItem(W14_KEY);
    if (!raw) return seedState();
    const saved = JSON.parse(raw);
    if (!saved || saved._v !== 3 || !saved.ws) return seedState();
    let maxSeq = 1;
    Object.values(saved.ws).forEach((s: any) => (s.events || []).forEach((e: any) => { if (e.seq > maxSeq) maxSeq = e.seq; }));
    _seq = maxSeq + 1;
    return saved;
  } catch {
    return seedState();
  }
}

const Store: any = {
  state: loadState(),
  listeners: new Set<() => void>(),
  getSnapshot() { return Store.state; },
  subscribe(fn: () => void) { Store.listeners.add(fn); return () => Store.listeners.delete(fn); },
  emit() {
    if (!LIVE) {
      try { localStorage.setItem(W14_KEY, JSON.stringify(Store.state)); } catch { /* ignore quota */ }
    }
    Store.listeners.forEach((fn: () => void) => fn());
  },
  set(next: any) {
    Store.state = typeof next === 'function' ? next(Store.state) : { ...Store.state, ...next };
    Store.emit();
  },
  reset() { localStorage.removeItem(W14_KEY); _seq = 1; Store.state = seedState(); Store.emit(); },
  wsSlice(id?: string) { return Store.state.ws[id || Store.state.activeWs]; },
  log(evt: any, wsId?: string) {
    const id = wsId || Store.state.activeWs;
    const e = mkEvent({ ts: Date.now(), ...evt });
    Store.set((s: any) => ({
      ...s,
      ws: { ...s.ws, [id]: { ...s.ws[id], events: [e, ...s.ws[id].events].slice(0, 400) } },
    }));
    return e;
  },
  patchRecord(pid: string, patch: any) {
    const id = Store.state.activeWs;
    Store.set((s: any) => {
      const slice = s.ws[id];
      const roster = slice.roster.map((p: any) => (p.id === pid ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p));
      return { ...s, ws: { ...s.ws, [id]: { ...slice, roster } } };
    });
    return Store.wsSlice(id).roster.find((p: any) => p.id === pid);
  },
};

const recalcRisk = (p: any) => {
  const hasHigh = p.blockers.some((id: string) => (BLOCKERS.find((b) => b.id === id) || {}).sev === 'high');
  if (hasHigh || p.readiness < 50) return 'high';
  if (p.blockers.length || p.overdue || p.readiness < 72) return 'med';
  return 'low';
};

const Ops = {
  assignWork(p: any, userId: string, actorId?: string) {
    const u = TEAM.find((t) => t.id === userId);
    Store.patchRecord(p.id, { assignee: userId });
    Store.log({ type: 'work_assigned', actor: actorId || userId, subjectId: p.id, subject: p.name, group: p.group, detail: `Assigned to ${u ? u.name : 'team'}` });
  },
  approveEvidence(p: any, actorId?: string) {
    const next = Store.patchRecord(p.id, (q: any) => ({ readiness: Math.min(100, q.readiness + 8) }));
    Store.patchRecord(p.id, (q: any) => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'evidence_approved', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: `Readiness conferred · now ${next.readiness}%` });
  },
  resolveBlocker(p: any, blockerId: string, actorId?: string) {
    const b = BLOCKERS.find((x) => x.id === blockerId);
    Store.patchRecord(p.id, (q: any) => ({ blockers: q.blockers.filter((id: string) => id !== blockerId), readiness: Math.min(100, q.readiness + 4) }));
    Store.patchRecord(p.id, (q: any) => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'blocker_resolved', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: b ? b.label : 'Blocker cleared' });
  },
  escalate(p: any, actorId?: string) {
    Store.patchRecord(p.id, { flagged: true });
    Store.log({ type: 'issue_escalated', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Raised to leadership attention queue' });
    Store.log({ type: 'org_notified', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Leadership notified' });
  },
  advanceStage(p: any, ws: any, actorId?: string) {
    const last = ws.stages.length - 1;
    if (p.stageIdx >= last) return;
    const nextIdx = p.stageIdx + 1;
    const stage = ws.stages[nextIdx];
    Store.patchRecord(p.id, {
      stageIdx: nextIdx, isActive: nextIdx === last, daysInStage: 0, overdue: false,
      sla: stage.sla || 0, owner: stage.owner, readiness: Math.min(100, p.readiness + 6),
    });
    Store.patchRecord(p.id, (q: any) => ({ risk: recalcRisk(q) }));
    Store.log({ type: 'stage_advanced', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: `Now in ${stage.label}` });
    if (nextIdx === last) Store.log({ type: 'recognition_updated', actor: actorId, subjectId: p.id, subject: p.name, group: p.group, detail: 'Professional Trust profile activated' });
  },
};

function useStore(): any { return React.useSyncExternalStore(Store.subscribe, Store.getSnapshot, Store.getSnapshot); }

function useWorkspace() {
  const s = useStore();
  const def = WORKSPACES.find((w) => w.id === s.activeWs) || WORKSPACES[0];
  const slice = s.ws[def.id];
  return { def, slice, roster: slice.roster, events: slice.events, terms: def.terms, accent: def.accent, live: s.live };
}

function useAccentTheme(accent: string, rootRef: React.RefObject<HTMLElement | null>) {
  React.useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', hexA(accent, 0.12));
    root.style.setProperty('--accent-ring', hexA(accent, 0.3));
    root.style.setProperty('--accent-glow', hexA(accent, 0.06));
  }, [accent, rootRef]);
}

const HEARTBEAT_TYPES = ['evidence_submitted', 'verification_done', 'interview_done', 'readiness_changed', 'org_notified', 'recognition_updated'];
function startHeartbeat() {
  const tick = () => {
    const s = Store.state;
    if (s.live) {
      const wsId = s.activeWs;
      const def = WORKSPACES.find((w) => w.id === wsId);
      const slice = s.ws[wsId];
      if (def && slice && slice.roster.length) {
        const r = rng((Date.now() & 0xffffff) ^ hashStr(wsId));
        const p = slice.roster[Math.floor(r() * slice.roster.length)];
        const type = HEARTBEAT_TYPES[Math.floor(r() * HEARTBEAT_TYPES.length)];
        if (type === 'readiness_changed' && !p.isActive) {
          const next = Store.patchRecord(p.id, (q: any) => ({ readiness: Math.max(10, Math.min(100, q.readiness + (r() < 0.6 ? 1 : -1) * (1 + Math.floor(r() * 3)))) }));
          Store.log({ type, actor: null, subjectId: p.id, subject: p.name, group: p.group, detail: `Readiness now ${next.readiness}%`, system: true });
        } else {
          Store.log({ type, actor: null, subjectId: p.id, subject: p.name, group: p.group, detail: detailFor(type, p, def), system: true });
        }
      }
    }
    setTimeout(tick, 5200 + Math.random() * 3200);
  };
  setTimeout(tick, 4000);
}

// ── live-mode data switch ──
// Build the engine's module data from a real OpsSnapshot and seed the Store.
// References to WORKSPACES/TEAM/ROLES/BLOCKERS resolve the current binding at
// call time, so this swaps the entire dataset without touching any component.
const LIVE_ROLE = { id: 'employer', label: 'Reviewer', short: 'Reviewer', icon: 'Building', accent: '#34d8e8' };

function stateFromSnapshot(snapshot: OpsSnapshot) {
  const ws: any = {};
  (snapshot.workspaces || []).forEach((w: any) => {
    ws[w.id] = { roster: w.records || [], events: w.events || [] };
  });
  const first = snapshot.workspaces && snapshot.workspaces[0];
  return { activeWs: first ? first.id : null, ws, live: false, _v: 3 };
}

function __loadLive(snapshot: OpsSnapshot) {
  LIVE = true;
  WORKSPACES = snapshot.workspaces || [];
  TEAM = WORKSPACES.flatMap((w: any) => w.team || []);
  BLOCKERS = WORKSPACES.flatMap((w: any) => w.blockerCatalog || []);
  ROLES = { ...DEMO_ROLES, employer: LIVE_ROLE };
  Store.state = stateFromSnapshot(snapshot);
}

function __loadDemo() {
  if (!LIVE) return;
  LIVE = false;
  WORKSPACES = DEMO_WORKSPACES;
  TEAM = DEMO_TEAM;
  ROLES = DEMO_ROLES;
  BLOCKERS = DEMO_BLOCKERS;
}

// Re-hydrate the live Store from a fresh snapshot (after an action or poll).
function refreshLive(snapshot: OpsSnapshot) {
  if (!LIVE || snapshot.status !== 'live') return;
  WORKSPACES = snapshot.workspaces || [];
  TEAM = WORKSPACES.flatMap((w: any) => w.team || []);
  BLOCKERS = WORKSPACES.flatMap((w: any) => w.blockerCatalog || []);
  const prevActive = Store.state.activeWs;
  const next = stateFromSnapshot(snapshot);
  if (prevActive && next.ws[prevActive]) next.activeWs = prevActive;
  Store.set(next);
}

async function fetchLiveSnapshot(): Promise<OpsSnapshot | null> {
  try {
    const res = await fetch('/api/ops-engine/snapshot', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as OpsSnapshot;
  } catch {
    return null;
  }
}

// Real write-action → backend (via the authed proxy), then re-hydrate.
// 'accept' is not offered here: acceptance is a packet-bound decision owned by
// the employer decision surface. A failed action must never look successful.
async function runLiveAction(record: any, action: 'request_info' | 'reject', reviewNote?: string, requests?: any[]) {
  let failure: string | null = null;
  try {
    const res = await fetch('/api/ops-engine/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ applicationId: record.sourceRef || record.id, action, reviewNote, requests }),
    });
    if (!res.ok) failure = `Action failed (${res.status}). Nothing was recorded.`;
  } catch {
    failure = 'Action failed to reach the server. Nothing was recorded.';
  }
  if (failure) window.alert(failure);
  const snap = await fetchLiveSnapshot();
  if (snap) refreshLive(snap);
}

// ───────────────────────────── primitives / selectors ─────────────────────────────
const cn = (...xs: any[]) => xs.filter(Boolean).join(' ');
function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16),
    g = parseInt(h.slice(2, 4), 16),
    b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function timeAgo(ts: number) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.round(h / 24);
  return d + 'd ago';
}
function clockTime(ts: number) { return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }

function priorityScore(p: any) {
  let s = 0;
  if (p.risk === 'high') s += 50;
  else if (p.risk === 'med') s += 24;
  s += p.blockers.length * 14;
  if (p.overdue) s += 22 + Math.min(20, p.daysInStage - p.sla);
  if (p.flagged) s += 18;
  if (p.isActive && p.licenseDays != null && p.licenseDays <= 90) s += Math.max(8, 90 - p.licenseDays) / 2;
  s += Math.max(0, 70 - p.readiness) / 4;
  return Math.round(s);
}
function priorityBand(score: number) { return score >= 70 ? 'P1' : score >= 40 ? 'P2' : 'P3'; }

function buildQueues(def: any, roster: any[]) {
  return QUEUE_DEFS.map((q) => {
    const items = roster.filter((p) => q.match(p, def)).map((p) => ({ ...p, score: priorityScore(p) })).sort((a, b) => b.score - a.score);
    const p1 = items.filter((i) => i.score >= 70).length;
    return { ...q, items, count: items.length, p1 };
  });
}

function aggregates(def: any, roster: any[]) {
  const inMotion = roster.filter((p) => !p.isActive);
  const active = roster.filter((p) => p.isActive);
  const readinessAvg = inMotion.length ? Math.round(inMotion.reduce((a, p) => a + p.readiness, 0) / inMotion.length) : 100;
  const atRiskHigh = roster.filter((p) => p.risk === 'high').length;
  const atRiskMed = roster.filter((p) => p.risk === 'med').length;
  const blocked = roster.filter((p) => p.blockers.length).length;
  const overdue = roster.filter((p) => p.overdue).length;
  const expiring = active.filter((p) => p.licenseDays != null && p.licenseDays <= 90).length;
  const nearlyReady = inMotion.filter((p) => p.readiness >= 85).length;
  const escalations = roster.filter((p) => p.flagged).length;
  const byGroup: any = {};
  def.groups.forEach((g: string) => (byGroup[g] = { group: g, motion: 0, active: 0, risk: 0 }));
  roster.forEach((p) => {
    const g = byGroup[p.group];
    if (!g) return;
    if (p.isActive) g.active++;
    else g.motion++;
    if (p.risk === 'high') g.risk++;
  });
  const groups = Object.values(byGroup);
  return { inMotion: inMotion.length, active: active.length, readinessAvg, atRiskHigh, atRiskMed, blocked, overdue, expiring, nearlyReady, escalations, groups, total: roster.length };
}

const RISK: Record<string, any> = { high: { c: '#ec7a9b', label: 'High' }, med: { c: '#f0a93a', label: 'Medium' }, low: { c: '#5ed6a4', label: 'Low' } };

function Button({ variant = 'primary', size = 'md', children, className = '', iconRight, iconLeft, onClick, disabled, title, type = 'button' }: any) {
  const base = 'inline-flex items-center justify-center font-medium rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap';
  const sizes: any = { xs: 'text-[11px] h-7 px-2.5 gap-1.5', sm: 'text-[12px] h-8 px-3 gap-1.5', md: 'text-[13px] h-9 px-3.5 gap-2', lg: 'text-[14px] h-11 px-5 gap-2' };
  const variants: any = {
    primary: 'text-slate-950 accent-bg',
    outline: 'bg-white/0 text-slate-200 border border-white/15 hover:bg-white/5 hover:border-white/30',
    ghost: 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5',
    dark: 'bg-white/[0.04] text-slate-200 hover:bg-white/[0.08] border border-white/8',
    emerald: 'bg-emerald-500/14 text-emerald-300 border border-emerald-400/25 hover:bg-emerald-500/22',
    danger: 'bg-rose-500/12 text-rose-300 border border-rose-400/25 hover:bg-rose-500/20',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cn(base, sizes[size], variants[variant], className)}>
      {iconLeft}
      {children && <span>{children}</span>}
      {iconRight}
    </button>
  );
}

function Panel({ children, className = '', as: As = 'div', ...rest }: any) {
  return (
    <As className={cn('bg-[#141922] border border-white/[0.08] rounded-xl', className)} {...rest}>
      {children}
    </As>
  );
}
function PanelHead({ icon: I, title, sub, right, className = '' }: any) {
  return (
    <div className={cn('px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between gap-3', className)}>
      <div className="flex items-center gap-2.5 min-w-0">
        {I && <I size={15} className="accent-text flex-shrink-0" />}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-slate-100 truncate">{title}</div>
          {sub && <div className="text-[11px] text-slate-500 truncate mt-0.5">{sub}</div>}
        </div>
      </div>
      {right != null && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
function Eyebrow({ children, className = '' }: any) {
  return <div className={cn('mono text-[10px] uppercase tracking-[0.18em] accent-text', className)}>{children}</div>;
}
function SurfaceIntro({ eyebrow, title, sub, right }: any) {
  return (
    <div className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0">
        <Eyebrow className="mb-2.5">{eyebrow}</Eyebrow>
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] text-slate-50 leading-[1.05]">{title}</h1>
        {sub && <p className="mt-3 text-[13.5px] text-slate-400 leading-[1.6] max-w-[78ch] text-pretty">{sub}</p>}
      </div>
      {right && <div className="flex-shrink-0">{right}</div>}
    </div>
  );
}
function Stat({ label, value, unit, color, sub }: any) {
  return (
    <div>
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="flex items-baseline gap-1.5 mt-1">
        <span className="text-[26px] font-semibold tabular-nums leading-none" style={{ color: color || 'var(--accent)' }}>{value}</span>
        {unit && <span className="text-[12px] text-slate-500">{unit}</span>}
      </div>
      {sub && <div className="text-[10.5px] text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
function Bar({ value, max = 100, color, track = 'rgba(255,255,255,0.06)', h = 5 }: any) {
  return (
    <span className="relative block rounded-full overflow-hidden w-full" style={{ height: h, background: track }}>
      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color || 'var(--accent)', transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />
    </span>
  );
}
function Pill({ children, tone = 'slate', className = '' }: any) {
  const tones: any = {
    slate: 'bg-white/[0.05] text-slate-300 ring-white/10',
    accent: 'accent-soft-bg accent-text accent-ring',
    emerald: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25',
    amber: 'bg-amber-500/12 text-amber-300 ring-amber-400/25',
    rose: 'bg-rose-500/12 text-rose-300 ring-rose-400/25',
    blue: 'bg-sky-500/12 text-sky-300 ring-sky-400/25',
  };
  return <span className={cn('inline-flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.07em] rounded-full px-2 py-0.5 ring-1 ring-inset whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

function RiskDot({ risk, size = 7 }: any) {
  const c = (RISK[risk] || RISK.low).c;
  return <span className="rounded-full flex-shrink-0 inline-block" style={{ width: size, height: size, background: c, boxShadow: `0 0 0 3px ${hexA(c, 0.16)}` }} />;
}
function PriorityTag({ score }: any) {
  const band = priorityBand(score);
  const tone = band === 'P1' ? 'rose' : band === 'P2' ? 'amber' : 'slate';
  return <Pill tone={tone}>{band}</Pill>;
}
function Avatar({ userId, size = 22 }: any) {
  const u = TEAM.find((t) => t.id === userId);
  if (!u) return <span className="rounded-full bg-white/[0.06] flex items-center justify-center text-slate-500 flex-shrink-0" style={{ width: size, height: size }}><Icon.User size={size * 0.5} /></span>;
  const role = ROLES[u.role] || {};
  return (
    <span className="rounded-full flex items-center justify-center font-semibold text-slate-950 flex-shrink-0" title={u.name} style={{ width: size, height: size, background: role.accent || '#34d8e8', fontSize: size * 0.4 }}>
      {u.initials}
    </span>
  );
}
function RoleChip({ roleId }: any) {
  const r = ROLES[roleId];
  if (!r) return null;
  const I = Icon[r.icon] || Icon.User;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
      <span className="rounded flex items-center justify-center flex-shrink-0" style={{ background: hexA(r.accent, 0.16), color: r.accent, width: 18, height: 18 }}><I size={11} /></span>
      <span className="truncate">{r.short}</span>
    </span>
  );
}

/* router (hash-based, scoped to this route's URL) */
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const parts = h.split('/').filter(Boolean);
  return { surface: parts[0] || 'operations', arg: parts[1] || null };
}
function useRoute() {
  const [route, setRoute] = React.useState(parseHash);
  React.useEffect(() => {
    const on = () => { setRoute(parseHash()); window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
function navTo(surface: string, arg?: string) { window.location.hash = arg ? `#/${surface}/${arg}` : `#/${surface}`; }

const SURFACES = [
  { id: 'operations', label: 'Operations', sub: 'mission control', Icon: 'Radar' },
  { id: 'queues', label: 'Work Queues', sub: 'what to do next', Icon: 'ListChecks' },
  { id: 'command', label: 'Command', sub: 'do the work', Icon: 'Command' },
  { id: 'timeline', label: 'Timeline', sub: 'audit trail', Icon: 'GitCommit' },
  { id: 'executive', label: 'Executive', sub: 'leadership view', Icon: 'Award' },
];

function WorkspaceSwitcher() {
  const s = useStore();
  const [open, setOpen] = React.useState(false);
  const def = WORKSPACES.find((w) => w.id === s.activeWs) || WORKSPACES[0];
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const on = (e: any) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', on);
    return () => document.removeEventListener('pointerdown', on);
  }, []);
  const I = Icon[def.icon] || Icon.Building;
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 h-10 pl-2 pr-2.5 rounded-lg border border-white/10 bg-white/[0.03] hover:border-white/20 transition-colors max-w-[280px]">
        <span className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(def.accent, 0.16), color: def.accent }}><I size={14} /></span>
        <span className="min-w-0 text-left">
          <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{def.short} · {def.type}</span>
          <span className="block mono text-[9px] uppercase tracking-[0.12em] text-slate-500 leading-tight truncate">{def.name}</span>
        </span>
        <Icon.ChevronDown size={14} className={cn('text-slate-500 transition-transform flex-shrink-0', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute left-0 top-12 z-50 w-[340px] bg-[#11161e] border border-white/12 rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
          <div className="px-3.5 py-2.5 border-b border-white/[0.07] flex items-center justify-between">
            <span className="mono text-[9.5px] uppercase tracking-[0.16em] text-slate-500">Switch organization</span>
            <span className="mono text-[9.5px] text-slate-600">{WORKSPACES.length} live</span>
          </div>
          <div className="p-1.5 max-h-[62vh] overflow-y-auto scroll-thin">
            {WORKSPACES.map((w) => {
              const WI = Icon[w.icon] || Icon.Building;
              const active = w.id === s.activeWs;
              const slice = s.ws[w.id];
              const agg = aggregates(w, slice.roster);
              return (
                <button key={w.id} onClick={() => { Store.set({ activeWs: w.id }); setOpen(false); navTo('operations'); }} className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left', active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]')}>
                  <span className="h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: hexA(w.accent, 0.16), color: w.accent }}><WI size={15} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-semibold text-slate-100 leading-tight truncate">{w.name}</span>
                    <span className="block text-[10.5px] text-slate-500 truncate">{w.type} · {agg.inMotion} in motion · {agg.atRiskHigh} at risk</span>
                  </span>
                  {active && <Icon.Check size={15} style={{ color: w.accent }} className="flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TopChrome({ surface }: any) {
  const { def, roster, events, live } = useWorkspace();
  const agg = aggregates(def, roster);
  const last = events[0];
  return (
    <div className="sticky top-0 z-40 bg-[#0b0e13]/92 backdrop-blur border-b border-white/[0.07]">
      <div className="bg-black/40 text-slate-400 text-[11px] border-b border-white/[0.05]">
        <div className="max-w-[1560px] mx-auto px-6 h-8 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="mono uppercase tracking-[0.16em] text-slate-500 font-medium">Operations Engine</span>
            {LIVE ? (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 ring-1 ring-inset ring-emerald-400/25 bg-emerald-500/12 text-emerald-300 mono text-[9px] uppercase tracking-[0.12em] flex-shrink-0" title="Live data from the VitalCV backend"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />Live</span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 ring-1 ring-inset ring-amber-400/25 bg-amber-500/12 text-amber-300 mono text-[9px] uppercase tracking-[0.12em] flex-shrink-0" title="Seeded demonstration data — not a live roster">Demo data</span>
            )}
            <span className="text-slate-700">/</span>
            <span className="truncate"><span className="mono accent-text">{agg.inMotion}</span> in motion · <span className="mono text-rose-300">{agg.atRiskHigh}</span> at risk · <span className="mono text-amber-300">{agg.overdue}</span> overdue</span>
          </div>
          <div className="hidden md:flex items-center gap-3 text-slate-500">
            <button onClick={() => Store.set((s: any) => ({ live: !s.live }))} className="inline-flex items-center gap-1.5 hover:text-slate-200 transition-colors" title={live ? 'Pause live feed' : 'Resume live feed'}>
              <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-emerald-400 blink' : 'bg-slate-600')} />
              {live ? 'live' : 'paused'}
            </button>
            <span className="h-3 w-px bg-slate-700" />
            <span className="mono truncate max-w-[210px]">{last ? `${EVENT_TYPES[last.type] ? EVENT_TYPES[last.type].label : last.type} · ${timeAgo(last.ts)}` : 'vc.2026.06.27 · w1400'}</span>
          </div>
        </div>
      </div>
      <div className="max-w-[1560px] mx-auto px-6 h-14 flex items-center justify-between gap-5">
        <div className="flex items-center gap-5 min-w-0">
          <Brandmark />
          <span className="hidden md:block h-6 w-px bg-white/10" />
          <WorkspaceSwitcher />
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden xl:inline-flex items-center gap-1.5 text-[12px] text-slate-500">
            <Icon.GitCommit size={14} className="accent-text" />
            <span>Every action writes an immutable event</span>
          </span>
          {!LIVE && <Button size="sm" variant="outline" iconLeft={<Icon.RotateCw size={13} />} onClick={() => { if (confirm('Reset all operational data to seed state?')) Store.reset(); }} title="Reset operational data">Reset</Button>}
        </div>
      </div>
      <div className="border-t border-white/[0.05]">
        <div className="max-w-[1560px] mx-auto px-4 flex items-center gap-0.5 overflow-x-auto scroll-thin" role="tablist" aria-label="Engine surfaces">
          {SURFACES.map((sf) => {
            const SI = Icon[sf.Icon] || Icon.Dot;
            const active = surface === sf.id;
            return (
              <button key={sf.id} role="tab" aria-selected={active} onClick={() => navTo(sf.id)} className={cn('group relative px-3.5 h-11 text-[12.5px] font-medium transition-colors flex items-center gap-2 whitespace-nowrap', active ? 'text-slate-50' : 'text-slate-400 hover:text-slate-100')}>
                <SI size={14} className={active ? 'accent-text' : 'text-slate-500 group-hover:text-slate-300'} />
                <span>{sf.label}</span>
                <span className="hidden lg:inline mono text-[9px] uppercase tracking-[0.12em] text-slate-600">{sf.sub}</span>
                {active && <span className="absolute left-2 right-2 bottom-0 h-[2px] rounded-full accent-bg" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
function Brandmark() {
  return (
    <a href="#/operations" className="flex items-center gap-2.5 group flex-shrink-0">
      <span className="relative h-5 w-5">
        <span className="absolute inset-0 accent-bg rounded-[5px]" />
        <svg viewBox="0 0 20 20" className="absolute inset-0 text-slate-950 h-5 w-5">
          <rect x="4" y="4" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="11" y="4" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
          <rect x="11" y="11" width="5" height="5" rx="1" fill="currentColor" />
          <rect x="4" y="11" width="5" height="5" rx="1" fill="currentColor" opacity="0.6" />
        </svg>
      </span>
      <span className="hidden sm:inline font-semibold tracking-[-0.01em] text-slate-100 text-[14px]">
        VitalCV<span className="text-slate-600 font-normal">/</span><span className="accent-text font-normal">ops</span>
      </span>
      <span className="hidden xl:inline whitespace-nowrap mono text-[9px] uppercase tracking-[0.14em] text-slate-500 border border-white/10 rounded px-1.5 py-0.5">Wave 1400</span>
    </a>
  );
}
function SectionLabel({ children, right }: any) {
  return (
    <div className="flex items-center justify-between gap-3 mb-2.5">
      <span className="mono text-[10px] uppercase tracking-[0.16em] text-slate-500">{children}</span>
      {right}
    </div>
  );
}

// ───────────────────────────── drawer + command store ─────────────────────────────
const Drawer: any = {
  pid: null,
  actor: 'u1',
  listeners: new Set<() => void>(),
  sub(fn: () => void) { Drawer.listeners.add(fn); return () => Drawer.listeners.delete(fn); },
  snap() { return Drawer; },
  open(pid: string) { Drawer.pid = pid; Drawer.emit(); },
  close() { Drawer.pid = null; Drawer.emit(); },
  setActor(id: string) { Drawer.actor = id; Drawer.emit(); },
  emit() { Drawer._v = (Drawer._v || 0) + 1; Drawer.listeners.forEach((f: () => void) => f()); },
  _v: 0,
};
const openRecord = (pid: string) => Drawer.open(pid);
function useDrawer() {
  React.useSyncExternalStore(Drawer.sub, () => Drawer._v, () => Drawer._v);
  return Drawer;
}

function RecordDrawer() {
  const d = useDrawer();
  const { def, roster, events } = useWorkspace();
  const p = roster.find((x: any) => x.id === d.pid);
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') Drawer.close(); };
    if (d.pid) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d.pid]);
  if (!d.pid || !p) return null;

  const stage = def.stages[p.stageIdx];
  const isLast = p.stageIdx === def.stages.length - 1;
  const recEvents = events.filter((e: any) => e.subjectId === p.id).slice(0, 8);
  const act = (fn: () => void) => fn();

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => Drawer.close()} />
      <div className="relative w-full max-w-[480px] bg-[#0e131b] border-l border-white/10 h-full overflow-y-auto scroll-thin shadow-2xl" style={{ animation: 'w14slide .28s cubic-bezier(.2,.7,.2,1)' }}>
        <div className="sticky top-0 z-10 bg-[#0e131b]/95 backdrop-blur border-b border-white/[0.07] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <RiskDot risk={p.risk} size={9} />
              <div className="min-w-0">
                <div className="text-[15px] font-semibold text-slate-50 truncate">{p.name}</div>
                <div className="text-[11px] text-slate-500 truncate">{p.specialty} · {p.group} · NPI {p.npi}</div>
              </div>
            </div>
            <button onClick={() => Drawer.close()} className="text-slate-500 hover:text-white transition-colors flex-shrink-0"><Icon.X size={18} /></button>
          </div>
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <Pill tone={p.risk === 'high' ? 'rose' : p.risk === 'med' ? 'amber' : 'emerald'}>{RISK[p.risk].label} risk</Pill>
            <Pill tone="accent">{stage.label}</Pill>
            {p.overdue && <Pill tone="amber">{p.daysInStage - p.sla}d past SLA</Pill>}
            {p.flagged && <Pill tone="rose">escalated</Pill>}
            {p.isActive && p.licenseDays != null && p.licenseDays <= 90 && <Pill tone="amber">license {p.licenseDays}d</Pill>}
          </div>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="mono uppercase tracking-[0.12em] text-slate-500">Credential readiness</span>
              <span className="mono tabular-nums font-semibold" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span>
            </div>
            <Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : p.readiness >= 50 ? '#f0a93a' : '#ec7a9b'} h={6} />
            <div className="flex items-center gap-1 mt-3 overflow-x-auto scroll-thin">
              {def.stages.map((s: any, i: number) => (
                <React.Fragment key={s.id}>
                  <div className={cn('flex-shrink-0 h-1.5 rounded-full transition-colors', i < p.stageIdx ? 'accent-bg' : i === p.stageIdx ? 'bg-white' : 'bg-white/10')} style={{ width: i === p.stageIdx ? 22 : 14 }} title={s.label} />
                </React.Fragment>
              ))}
            </div>
            <div className="mono text-[9.5px] text-slate-600 mt-1.5">stage {p.stageIdx + 1} of {def.stages.length} · {stage.label}</div>
          </div>

          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Actions — each writes an event</div>
            {LIVE ? (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="dark" iconLeft={<Icon.Mail size={14} />} onClick={() => { const note = window.prompt('What document or information is needed from the applicant?'); if (note && note.trim()) runLiveAction(p, 'request_info', note.trim(), [{ field: 'documentation', message: note.trim() }]); }}>Request info</Button>
                <Button size="sm" variant="danger" iconLeft={<Icon.X size={14} />} onClick={() => { if (window.confirm(`Reject ${p.name}? This writes a real decision.`)) runLiveAction(p, 'reject'); }} disabled={p.flagged}>{p.flagged ? 'Rejected' : 'Reject'}</Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="primary" iconLeft={<Icon.CheckCircle size={14} />} onClick={() => act(() => Ops.approveEvidence(p, Drawer.actor))} disabled={isLast}>Approve evidence</Button>
                <Button size="sm" variant="dark" iconLeft={<Icon.ArrowRight size={14} />} onClick={() => act(() => Ops.advanceStage(p, def, Drawer.actor))} disabled={isLast}>{isLast ? 'Active' : 'Advance stage'}</Button>
                <Button size="sm" variant="dark" iconLeft={<Icon.ChevronsUp size={14} />} onClick={() => act(() => Ops.escalate(p, Drawer.actor))} disabled={p.flagged}>{p.flagged ? 'Escalated' : 'Escalate'}</Button>
                <Button size="sm" variant="dark" iconLeft={<Icon.Bell size={14} />} onClick={() => act(() => Store.log({ type: 'org_notified', actor: Drawer.actor, subjectId: p.id, subject: p.name, group: p.group, detail: `${def.short} notified of current status` }))}>Notify org</Button>
              </div>
            )}
          </div>

          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Blockers ({p.blockers.length})</div>
            {p.blockers.length === 0 ? (
              <div className="rounded-lg bg-emerald-500/8 ring-1 ring-inset ring-emerald-400/20 px-3.5 py-2.5 text-[11.5px] text-emerald-300 flex items-center gap-2"><Icon.CheckCircle size={14} /> No active blockers on this record.</div>
            ) : (
              <div className="space-y-2">
                {p.blockers.map((bid: string) => {
                  const b = BLOCKERS.find((x) => x.id === bid) || { label: bid, sev: 'med' };
                  return (
                    <div key={bid} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] border border-white/[0.07] px-3 py-2">
                      <RiskDot risk={b.sev === 'high' ? 'high' : b.sev === 'med' ? 'med' : 'low'} size={6} />
                      <span className="text-[11.5px] text-slate-300 flex-1 min-w-0 truncate">{b.label}</span>
                      <Button size="xs" variant="emerald" iconLeft={<Icon.Unlock size={11} />} onClick={() => Ops.resolveBlocker(p, bid, Drawer.actor)}>Resolve</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            {!LIVE && <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Assigned to</div>}
            <div className="flex flex-wrap gap-1.5">
              {TEAM.filter((t) => t.role === stage.owner || t.role === 'cmo').slice(0, 5).map((u) => (
                <button key={u.id} onClick={() => Ops.assignWork(p, u.id, Drawer.actor)} className={cn('flex items-center gap-1.5 rounded-full pl-1 pr-2.5 py-1 border transition-colors', p.assignee === u.id ? 'accent-border bg-white/[0.05]' : 'border-white/10 hover:border-white/25')}>
                  <Avatar userId={u.id} size={18} />
                  <span className="text-[11px] text-slate-300">{u.name.split(' ')[0]}</span>
                  {p.assignee === u.id && <Icon.Check size={11} className="accent-text" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500 mb-2">Record history</div>
            <div className="space-y-0">
              {recEvents.length === 0 && <div className="text-[11.5px] text-slate-500">No events yet for this record.</div>}
              {recEvents.map((e: any, i: number) => {
                const ET = EVENT_TYPES[e.type] || {};
                const EI = Icon[ET.icon] || Icon.Dot;
                return (
                  <div key={e.id} className="flex gap-2.5 pb-3 last:pb-0">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <span className="h-5 w-5 rounded-full flex items-center justify-center accent-soft-bg accent-text"><EI size={11} /></span>
                      {i < recEvents.length - 1 && <span className="w-px flex-1 bg-white/10 my-0.5" />}
                    </div>
                    <div className="min-w-0 pb-1 -mt-0.5">
                      <div className="text-[11.5px] text-slate-200 leading-snug">{ET.label || e.type}</div>
                      <div className="text-[10px] text-slate-500 mono">{e.detail} · {timeAgo(e.ts)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0e131b]/95 backdrop-blur border-t border-white/[0.07] px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <Avatar userId={Drawer.actor} size={20} /> acting as <span className="text-slate-300">{(TEAM.find((t) => t.id === Drawer.actor) || {}).name}</span>
          </div>
          <button onClick={() => Drawer.close()} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:text-white transition-colors">close · esc</button>
        </div>
      </div>
    </div>
  );
}

function Select({ value, onChange, options }: any) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none h-8 pl-2.5 pr-7 bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-md text-[11.5px] text-slate-200 outline-none cursor-pointer">
        {options.map(([v, l]: any) => (<option key={v} value={v} className="bg-[#141922]">{l}</option>))}
      </select>
      <Icon.ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

function OperatorPicker() {
  const d = useDrawer();
  return (
    <div className="hidden md:flex items-center gap-2 border border-white/10 rounded-md pl-2.5 pr-2 py-2">
      <span className="mono text-[9.5px] uppercase tracking-[0.12em] text-slate-500">Acting as</span>
      <div className="relative">
        <select value={d.actor} onChange={(e) => Drawer.setActor(e.target.value)} className="appearance-none bg-transparent pr-5 text-[12px] font-medium text-slate-100 outline-none cursor-pointer">
          {TEAM.map((u) => (<option key={u.id} value={u.id} className="bg-[#141922]">{u.name} · {(ROLES[u.role] || {}).short}</option>))}
        </select>
        <Icon.ChevronDown size={12} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
      </div>
    </div>
  );
}

// ───────────────────────────── view: operations ─────────────────────────────
function ViewOperations() {
  const { def, roster, events, terms } = useWorkspace();
  const agg = aggregates(def, roster);
  const queues = buildQueues(def, roster);
  const last = events[0];

  const kpis = [
    { label: 'In motion', value: agg.inMotion, color: 'var(--accent)', sub: `${terms.providerPl.toLowerCase()} mid-pipeline` },
    { label: 'Workforce readiness', value: agg.readinessAvg + '%', color: agg.readinessAvg >= 75 ? '#5ed6a4' : '#f0a93a', sub: 'aggregate, in-motion' },
    { label: 'At risk', value: agg.atRiskHigh, color: '#ec7a9b', sub: `${agg.blocked} blocked · ${agg.overdue} overdue` },
    { label: 'Nearly ready', value: agg.nearlyReady, color: '#5ed6a4', sub: 'readiness ≥ 85%' },
    { label: 'Expiring creds', value: agg.expiring, color: '#f0a93a', sub: 'license < 90 days' },
    { label: 'Needs attention', value: agg.escalations, color: '#ec7a9b', sub: 'escalated to leadership' },
  ];

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Operations Center · W1400-D1" title={`${def.short} operations, live`} sub={`Mission control for ${def.name}. Every panel reads the live roster and the operational ledger — readiness, risk, pipeline, mobility, compliance and staffing all move in real time as the field acts. Work the alerts on the right; resolve them in Command.`} right={<LivePulse last={last} />} />

      <Panel className="rise">
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-white/[0.06]">
          {kpis.map((k, i) => (
            <div key={i} className="px-5 py-4">
              <Stat label={k.label} value={k.value} color={k.color} sub={k.sub} />
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ReadinessPanel def={def} roster={roster} agg={agg} />
          <div className="grid sm:grid-cols-2 gap-6">
            <RiskPanel agg={agg} roster={roster} />
            <MobilityPanel events={events} def={def} />
          </div>
          <PipelinePanel def={def} roster={roster} terms={terms} />
          <div className="grid sm:grid-cols-2 gap-6">
            <CompliancePanel agg={agg} roster={roster} />
            <StaffingPanel agg={agg} terms={terms} />
          </div>
        </div>

        <div className="space-y-6">
          <AlertsRail queues={queues} roster={roster} def={def} agg={agg} />
          <LiveFeed events={events} def={def} />
        </div>
      </div>
    </div>
  );
}

function LivePulse({ last }: any) {
  return (
    <div className="hidden md:flex items-center gap-2.5 border border-white/10 rounded-md px-3 py-2">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 blink" />
      <span className="mono text-[10px] uppercase tracking-[0.12em] text-slate-400">real-time</span>
      {last && <span className="mono text-[10px] text-slate-600">· last {timeAgo(last.ts)}</span>}
    </div>
  );
}

function StatPanelHead({ icon, title, kicker, right }: any) {
  return <PanelHead icon={icon} title={title} sub={kicker} right={right} />;
}

function ReadinessPanel({ def, roster, agg }: any) {
  const inMotion = roster.filter((p: any) => !p.isActive);
  const bands = [
    { label: 'Ready (≥85%)', tone: '#5ed6a4', n: inMotion.filter((p: any) => p.readiness >= 85).length },
    { label: 'On track (70–84%)', tone: '#34d8e8', n: inMotion.filter((p: any) => p.readiness >= 70 && p.readiness < 85).length },
    { label: 'Lagging (50–69%)', tone: '#f0a93a', n: inMotion.filter((p: any) => p.readiness >= 50 && p.readiness < 70).length },
    { label: 'At risk (<50%)', tone: '#ec7a9b', n: inMotion.filter((p: any) => p.readiness < 50).length },
  ];
  const total = inMotion.length || 1;
  return (
    <Panel>
      <StatPanelHead icon={Icon.Gauge} title="Workforce Readiness" kicker={`${agg.readinessAvg}% aggregate across ${inMotion.length} in motion`} right={<button onClick={() => navTo('queues')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">work queue →</button>} />
      <div className="p-5">
        <div className="flex h-3 rounded-full overflow-hidden bg-white/[0.04]">
          {bands.map((b, i) => b.n > 0 && (<span key={i} title={`${b.label}: ${b.n}`} style={{ width: `${(b.n / total) * 100}%`, background: b.tone, transition: 'width .6s cubic-bezier(.2,.7,.2,1)' }} />))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {bands.map((b, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: b.tone }} />
              <div className="min-w-0">
                <div className="text-[16px] font-semibold tabular-nums leading-none" style={{ color: b.tone }}>{b.n}</div>
                <div className="text-[10px] text-slate-500 mt-1 leading-tight">{b.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function RiskPanel({ agg, roster }: any) {
  const total = roster.length || 1;
  const rows = [
    { k: 'high', label: 'High risk', n: agg.atRiskHigh },
    { k: 'med', label: 'Medium risk', n: agg.atRiskMed },
    { k: 'low', label: 'Low risk', n: total - agg.atRiskHigh - agg.atRiskMed },
  ];
  return (
    <Panel>
      <StatPanelHead icon={Icon.ShieldAlert} title="Credential Risk" kicker={`${agg.blocked} records carry a blocker`} />
      <div className="p-5 space-y-3.5">
        {rows.map((r) => (
          <div key={r.k}>
            <div className="flex items-center justify-between text-[11.5px] mb-1.5">
              <span className="flex items-center gap-2 text-slate-300"><RiskDot risk={r.k} size={7} /> {r.label}</span>
              <span className="mono tabular-nums" style={{ color: RISK[r.k].c }}>{r.n}</span>
            </div>
            <Bar value={r.n} max={total} color={RISK[r.k].c} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MobilityPanel({ events }: any) {
  const moves = events.filter((e: any) => ['stage_advanced', 'offer_accepted', 'recognition_updated'].includes(e.type));
  const recent = moves.slice(0, 5);
  return (
    <Panel>
      <StatPanelHead icon={Icon.Route} title="Provider Mobility" kicker={`${moves.length} stage moves logged`} />
      <div className="p-5">
        {recent.length === 0 && <div className="text-[12px] text-slate-500 py-3">No movement yet.</div>}
        <div className="space-y-2.5">
          {recent.map((e: any) => {
            const ET = EVENT_TYPES[e.type] || {};
            const EI = Icon[ET.icon] || Icon.ArrowRight;
            return (
              <div key={e.id} className="flex items-center gap-2.5 min-w-0">
                <span className="h-6 w-6 rounded-md flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><EI size={12} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11.5px] text-slate-200 truncate">{e.subject}</span>
                  <span className="block text-[10px] text-slate-500 truncate">{e.detail}</span>
                </span>
                <span className="mono text-[9.5px] text-slate-600 flex-shrink-0">{timeAgo(e.ts)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </Panel>
  );
}

function PipelinePanel({ def, roster, terms }: any) {
  const counts = def.stages.map((s: any, i: number) => roster.filter((p: any) => p.stageIdx === i).length);
  const max = Math.max(1, ...counts.slice(0, -1));
  return (
    <Panel>
      <StatPanelHead icon={Icon.Filter} title="Hiring Pipeline" kicker={`${terms.providerPl} by stage, live`} right={<button onClick={() => navTo('command')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">command →</button>} />
      <div className="p-5 overflow-x-auto scroll-thin">
        <div className="flex items-end gap-2 min-w-max h-[150px]">
          {def.stages.map((s: any, i: number) => {
            const n = counts[i];
            const isLast = i === def.stages.length - 1;
            const h = isLast ? 1 : Math.max(0.06, n / max);
            const overdueN = roster.filter((p: any) => p.stageIdx === i && p.overdue).length;
            return (
              <div key={s.id} className="flex flex-col items-center justify-end h-full" style={{ width: 78 }}>
                <span className="mono text-[12px] font-semibold tabular-nums mb-1.5" style={{ color: isLast ? '#5ed6a4' : 'var(--accent)' }}>{n}</span>
                <div className="w-full rounded-t-md relative overflow-hidden" style={{ height: `${h * 100}%`, minHeight: 8, background: isLast ? hexA('#5ed6a4', 0.22) : hexA(def.accent, 0.2), boxShadow: `inset 0 0 0 1px ${isLast ? hexA('#5ed6a4', 0.4) : 'var(--accent-ring)'}` }}>
                  {overdueN > 0 && <span className="absolute bottom-0 left-0 right-0 bg-rose-500/40" style={{ height: `${(overdueN / Math.max(1, n)) * 100}%` }} />}
                </div>
                <span className="mono text-[8.5px] uppercase tracking-[0.06em] text-slate-500 mt-2 text-center leading-tight h-7 flex items-start justify-center">{s.label}</span>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-2 mono text-[9.5px] text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm accent-bg" /> in stage</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500/60" /> past SLA</span>
        </div>
      </div>
    </Panel>
  );
}

function CompliancePanel({ agg, roster }: any) {
  const active = roster.filter((p: any) => p.isActive);
  const expSoon = active.filter((p: any) => p.licenseDays != null && p.licenseDays <= 30).length;
  const lapsed = active.filter((p: any) => p.licenseDays != null && p.licenseDays < 0).length;
  const healthy = active.length - agg.expiring;
  const score = active.length ? Math.round((healthy / active.length) * 100) : 100;
  return (
    <Panel>
      <StatPanelHead icon={Icon.ShieldCheck} title="Compliance Health" kicker={`${score}% of active roster current`} />
      <div className="p-5">
        <div className="flex items-center gap-4">
          <Ring value={score} color={score >= 90 ? '#5ed6a4' : score >= 75 ? '#f0a93a' : '#ec7a9b'} />
          <div className="space-y-2 text-[11.5px] flex-1">
            <Row label="Within 90 days" value={agg.expiring} c="#f0a93a" />
            <Row label="Within 30 days" value={expSoon} c="#ec7a9b" />
            <Row label="Lapsed" value={lapsed} c="#ec7a9b" />
          </div>
        </div>
      </div>
    </Panel>
  );
}
function Row({ label, value, c }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="mono tabular-nums font-medium" style={{ color: value > 0 ? c : '#5ed6a4' }}>{value}</span>
    </div>
  );
}
function Ring({ value, color, size = 76 }: any) {
  const r = (size - 10) / 2,
    c = 2 * Math.PI * r,
    off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle" className="rotate-90 mono" style={{ transformOrigin: 'center', fill: color, fontSize: 16, fontWeight: 600 }}>{value}%</text>
    </svg>
  );
}

function StaffingPanel({ agg, terms }: any) {
  const groups = agg.groups.slice().sort((a: any, b: any) => b.risk - a.risk || b.motion - a.motion).slice(0, 6);
  const max = Math.max(1, ...agg.groups.map((g: any) => g.motion + g.active));
  return (
    <Panel>
      <StatPanelHead icon={Icon.Building} title="Staffing Gaps" kicker={`demand vs. active by ${terms.group.toLowerCase()}`} />
      <div className="p-5 space-y-3">
        {groups.map((g: any) => (
          <div key={g.group}>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-slate-300 truncate flex items-center gap-1.5">{g.risk > 0 && <RiskDot risk="high" size={6} />}{g.group}</span>
              <span className="mono text-slate-500"><span className="accent-text">{g.motion}</span> in / <span className="text-emerald-300">{g.active}</span> active</span>
            </div>
            <Bar value={g.motion} max={max} color="var(--accent)" h={4} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

function AlertsRail({ roster, def, agg }: any) {
  const alerts = roster.map((p: any) => ({ ...p, score: priorityScore(p) })).filter((p: any) => p.score >= 40 || p.flagged).sort((a: any, b: any) => b.score - a.score).slice(0, 7);
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Siren} title="Active Alerts" sub={`${alerts.length} records need a decision now`} right={<Pill tone="rose">{agg.atRiskHigh} P1</Pill>} />
      <div className="divide-y divide-white/[0.05] max-h-[440px] overflow-y-auto scroll-thin">
        {alerts.map((p: any) => {
          const reason = p.blockers.length
            ? (BLOCKERS.find((b) => b.id === p.blockers[0]) || {}).label
            : p.overdue
              ? `${p.daysInStage - p.sla}d past SLA in ${def.stages[p.stageIdx].label}`
              : p.isActive && p.licenseDays <= 90
                ? `License expires in ${p.licenseDays}d`
                : `Readiness ${p.readiness}%`;
          return (
            <button key={p.id} onClick={() => openRecord(p.id)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] transition-colors flex items-start gap-3">
              <PriorityTag score={p.score} />
              <div className="min-w-0 flex-1">
                <div className="text-[12px] font-medium text-slate-100 truncate">{p.name}</div>
                <div className="text-[10.5px] text-slate-500 truncate mt-0.5">{reason}</div>
              </div>
              <Icon.ArrowUpRight size={13} className="text-slate-600 mt-0.5 flex-shrink-0" />
            </button>
          );
        })}
        {alerts.length === 0 && <div className="px-4 py-8 text-center text-[12px] text-slate-500">All clear — nothing urgent.</div>}
      </div>
      <div className="px-4 py-2.5 border-t border-white/[0.06]">
        <Button size="sm" variant="dark" className="w-full" iconRight={<Icon.ArrowRight size={13} />} onClick={() => navTo('queues')}>Open all work queues</Button>
      </div>
    </Panel>
  );
}

function LiveFeed({ events }: any) {
  return (
    <Panel className="overflow-hidden">
      <PanelHead icon={Icon.Activity} title="Live activity" sub="streaming from the ledger" right={<button onClick={() => navTo('timeline')} className="mono text-[10px] uppercase tracking-[0.12em] text-slate-500 hover:accent-text transition-colors">all →</button>} />
      <div className="max-h-[360px] overflow-y-auto scroll-thin">
        {events.slice(0, 12).map((e: any, i: number) => {
          const ET = EVENT_TYPES[e.type] || {};
          const EI = Icon[ET.icon] || Icon.Dot;
          return (
            <div key={e.id} className={cn('flex items-start gap-2.5 px-4 py-2.5 border-b border-white/[0.04]', i === 0 && 'bg-white/[0.02]')}>
              <span className="h-5 w-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: hexA('#7c8aa0', 0.12), color: '#a9b6c6' }}><EI size={11} /></span>
              <div className="min-w-0 flex-1">
                <div className="text-[11.5px] text-slate-200 leading-snug"><span className="font-medium">{ET.label || e.type}</span> <span className="text-slate-500">· {e.subject}</span></div>
                <div className="text-[10px] text-slate-600 mono mt-0.5">{e.actor ? (TEAM.find((t) => t.id === e.actor) || {}).name || 'system' : 'system'} · {timeAgo(e.ts)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ───────────────────────────── view: queues ─────────────────────────────
function ViewQueues() {
  const { def, roster, terms } = useWorkspace();
  const queues = buildQueues(def, roster);
  const [activeQ, setActiveQ] = React.useState<string | null>(null);
  const totalOpen = queues.reduce((a, q) => a + q.count, 0);
  const totalP1 = queues.reduce((a, q) => a + q.p1, 0);

  const sel = queues.find((q) => q.id === activeQ) || queues.slice().sort((a, b) => b.p1 - a.p1 || b.count - a.count)[0];

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Work Queues · W1400-D2" title="The work, sorted by what matters" sub={`Every open item across ${def.name}, grouped into operational queues. Each queue states its impact and recommends the next action; each record carries a computed priority. Clear the P1s first.`}
        right={<div className="hidden md:flex items-center gap-4 border border-white/10 rounded-md px-4 py-2.5"><Stat label="Open items" value={totalOpen} /><span className="h-8 w-px bg-white/10" /><Stat label="P1 urgent" value={totalP1} color="#ec7a9b" /></div>} />

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div className="space-y-2">
          <SectionLabel>Queues</SectionLabel>
          {queues.map((q) => {
            const QI = Icon[q.icon] || Icon.ListChecks;
            const active = sel && sel.id === q.id;
            return (
              <button key={q.id} onClick={() => setActiveQ(q.id)} className={cn('w-full text-left rounded-xl border p-3.5 transition-colors flex items-center gap-3', active ? 'bg-white/[0.05] accent-border' : 'border-white/[0.07] bg-[#141922] hover:border-white/18')}>
                <span className={cn('h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0', active ? 'accent-bg text-slate-950' : 'accent-soft-bg accent-text')}><QI size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-semibold text-slate-100 truncate">{q.label}</div>
                  <div className="text-[10.5px] text-slate-500 truncate mt-0.5"><RoleChip roleId={q.owner} /></div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[15px] font-semibold tabular-nums text-slate-100 leading-none">{q.count}</div>
                  {q.p1 > 0 && <div className="text-[9.5px] mono text-rose-300 mt-1">{q.p1} P1</div>}
                </div>
              </button>
            );
          })}
        </div>

        {sel && <QueueDetail q={sel} def={def} terms={terms} />}
      </div>
    </div>
  );
}

function QueueDetail({ q, def }: any) {
  const QI = Icon[q.icon] || Icon.ListChecks;
  const [bulk, setBulk] = React.useState(false);
  return (
    <div className="space-y-5">
      <Panel className="overflow-hidden rise">
        <div className="p-5" style={{ background: `linear-gradient(180deg, var(--accent-glow), transparent 70%)` }}>
          <div className="flex items-start gap-4">
            <span className="h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 accent-soft-bg accent-text"><QI size={22} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-[19px] font-semibold tracking-[-0.01em] text-slate-50">{q.label}</h2>
                <Pill tone="accent">{q.count} open</Pill>
                {q.p1 > 0 && <Pill tone="rose">{q.p1} P1</Pill>}
              </div>
              <p className="text-[12.5px] text-slate-400 mt-1.5 max-w-[70ch] text-pretty">{q.desc}</p>
            </div>
          </div>
          <div className="grid sm:grid-cols-3 gap-3 mt-5">
            <ExplainCard icon={Icon.ChevronsUp} label="Priority" tone="rose" body={`${q.p1} urgent · ${q.count - q.p1} routine. Records are ranked by risk, blockers, SLA breach and readiness.`} />
            <ExplainCard icon={Icon.Target} label="Impact" tone="accent" body={q.impact} />
            <ExplainCard icon={Icon.Wand} label="Recommended action" tone="emerald" body={q.action} />
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.ListChecks} title={`${q.count} records in this queue`} sub="ordered by priority — highest first" right={<Button size="xs" variant={bulk ? 'primary' : 'dark'} iconLeft={<Icon.ListChecks size={12} />} onClick={() => setBulk((b) => !b)}>Triage mode</Button>} />
        {q.items.length === 0 && <div className="px-5 py-10 text-center text-[13px] text-slate-500">This queue is clear. Nice work.</div>}
        <div className="divide-y divide-white/[0.05]">
          {q.items.map((p: any) => (
            <div key={p.id} className="px-5 py-3.5 hover:bg-white/[0.02] transition-colors flex items-center gap-4">
              <PriorityTag score={p.score} />
              <div className="min-w-0 flex-1">
                <button onClick={() => openRecord(p.id)} className="text-left group">
                  <div className="text-[13px] font-medium text-slate-100 group-hover:accent-text transition-colors truncate">{p.name}</div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">{p.specialty} · {p.group} · {def.stages[p.stageIdx].label}</div>
                </button>
              </div>
              {bulk && (
                <div className="hidden md:flex items-center gap-3 flex-shrink-0">
                  <div className="w-24">
                    <div className="flex items-center justify-between text-[9.5px] text-slate-500 mb-1"><span>readiness</span><span className="mono" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span></div>
                    <Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : '#f0a93a'} h={3} />
                  </div>
                </div>
              )}
              <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                <RiskDot risk={p.risk} />
                <span className="mono text-[10px] text-slate-500 w-16 text-right">{p.score} pts</span>
              </div>
              <Button size="xs" variant="dark" iconRight={<Icon.ArrowRight size={12} />} onClick={() => openRecord(p.id)}>Act</Button>
            </div>
          ))}
        </div>
        {q.items.length > 0 && (
          <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-between mono text-[10px] text-slate-500">
            <span>recommended: {q.action.toLowerCase()}</span>
            <span>{q.items.length} shown</span>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ExplainCard({ icon: I, label, tone, body }: any) {
  const ring = ({ rose: 'ring-rose-400/20', accent: 'accent-ring', emerald: 'ring-emerald-400/20' } as any)[tone] || 'ring-white/10';
  const col = ({ rose: 'text-rose-300', accent: 'accent-text', emerald: 'text-emerald-300' } as any)[tone] || 'text-slate-300';
  return (
    <div className={cn('rounded-lg bg-white/[0.02] ring-1 ring-inset p-3.5', ring)}>
      <div className={cn('flex items-center gap-1.5 mono text-[9.5px] uppercase tracking-[0.14em] mb-1.5', col)}><I size={12} /> {label}</div>
      <div className="text-[11.5px] text-slate-300 leading-snug text-pretty">{body}</div>
    </div>
  );
}

// ───────────────────────────── view: command ─────────────────────────────
function ViewCommand() {
  const d = useDrawer();
  const { def, roster, terms } = useWorkspace();
  const [stageF, setStageF] = React.useState('all');
  const [riskF, setRiskF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [sort, setSort] = React.useState('priority');

  let rows = roster.map((p: any) => ({ ...p, score: priorityScore(p) }));
  if (stageF !== 'all') rows = rows.filter((p: any) => String(p.stageIdx) === stageF);
  if (riskF !== 'all') rows = rows.filter((p: any) => p.risk === riskF);
  if (q.trim()) {
    const t = q.toLowerCase();
    rows = rows.filter((p: any) => p.name.toLowerCase().includes(t) || p.specialty.toLowerCase().includes(t) || p.group.toLowerCase().includes(t));
  }
  rows.sort((a: any, b: any) => (sort === 'priority' ? b.score - a.score : sort === 'readiness' ? a.readiness - b.readiness : a.name.localeCompare(b.name)));

  const mine = roster.filter((p: any) => p.assignee === Drawer.actor).map((p: any) => ({ ...p, score: priorityScore(p) })).sort((a: any, b: any) => b.score - a.score);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Command Center · W1400-D3" title="One workspace. Assign, resolve, approve, escalate." sub="Every record in one operational table. Filter to what you own, open any record, and act — each action advances the record and writes an immutable event to the ledger. This is the layer where Professional Trust becomes daily work." right={LIVE ? null : <OperatorPicker />} />

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[180px]">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${terms.providerPl.toLowerCase()}…`} className="w-full h-8 pl-8 pr-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-md text-[12px] text-slate-100 outline-none placeholder:text-slate-600" />
            </div>
            <Select value={stageF} onChange={setStageF} options={[['all', 'All stages'], ...def.stages.map((s: any, i: number) => [String(i), s.label])]} />
            <Select value={riskF} onChange={setRiskF} options={[['all', 'All risk'], ['high', 'High risk'], ['med', 'Medium'], ['low', 'Low']]} />
            <Select value={sort} onChange={setSort} options={[['priority', 'Sort: priority'], ['readiness', 'Sort: readiness'], ['name', 'Sort: name']]} />
          </div>
          <div className="px-4 py-2 border-b border-white/[0.05] grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
            <span className="w-8">Pri</span><span>Record</span><span className="hidden sm:block w-28">Stage</span><span className="hidden md:block w-24">Readiness</span><span className="w-16 text-right">Owner</span>
          </div>
          <div className="max-h-[620px] overflow-y-auto scroll-thin divide-y divide-white/[0.04]">
            {rows.map((p: any) => (
              <button key={p.id} onClick={() => Drawer.open(p.id)} className={cn('w-full px-4 py-2.5 grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center text-left hover:bg-white/[0.03] transition-colors', d.pid === p.id && 'bg-white/[0.04]')}>
                <span className="w-8"><PriorityTag score={p.score} /></span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2 min-w-0"><RiskDot risk={p.risk} /><span className="text-[12.5px] font-medium text-slate-100 truncate">{p.name}</span>{p.flagged && <Icon.Flag size={11} className="text-rose-400 flex-shrink-0" />}</span>
                  <span className="block text-[10px] text-slate-500 truncate mt-0.5 pl-4">{p.specialty} · {p.group}{p.blockers.length > 0 && <span className="text-rose-400/80"> · {p.blockers.length} blocker{p.blockers.length > 1 ? 's' : ''}</span>}</span>
                </span>
                <span className="hidden sm:block w-28 mono text-[10.5px] text-slate-400 truncate">{def.stages[p.stageIdx].label}</span>
                <span className="hidden md:block w-24"><div className="flex items-center justify-between text-[9.5px] mb-1"><span className="mono" style={{ color: p.readiness >= 75 ? '#5ed6a4' : '#f0a93a' }}>{p.readiness}%</span></div><Bar value={p.readiness} color={p.readiness >= 75 ? '#5ed6a4' : '#f0a93a'} h={3} /></span>
                <span className="w-16 flex justify-end"><Avatar userId={p.assignee} size={22} /></span>
              </button>
            ))}
            {rows.length === 0 && <div className="px-4 py-12 text-center text-[13px] text-slate-500">No records match.</div>}
          </div>
          <div className="px-4 py-2.5 border-t border-white/[0.06] mono text-[10px] text-slate-500 flex items-center justify-between">
            <span>{rows.length} of {roster.length} records</span>
            <span className="flex items-center gap-1.5"><Icon.Command size={11} /> click a row to open the command drawer</span>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <PanelHead icon={Icon.ListChecks} title="Your assigned work" sub={`${mine.length} records · ${(TEAM.find((t) => t.id === Drawer.actor) || {}).name}`} />
            <div className="max-h-[300px] overflow-y-auto scroll-thin divide-y divide-white/[0.05]">
              {mine.length === 0 && <div className="px-4 py-6 text-center text-[12px] text-slate-500">Nothing assigned to you. Assign work from any record.</div>}
              {mine.map((p: any) => (
                <button key={p.id} onClick={() => Drawer.open(p.id)} className="w-full px-4 py-2.5 flex items-center gap-2.5 text-left hover:bg-white/[0.03] transition-colors">
                  <PriorityTag score={p.score} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-medium text-slate-100 truncate">{p.name}</span>
                    <span className="block text-[10px] text-slate-500 truncate">{def.stages[p.stageIdx].label}</span>
                  </span>
                  <Icon.ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
                </button>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHead icon={Icon.GitCommit} title="How the ledger works" />
            <div className="p-4 space-y-2.5 text-[11.5px] text-slate-400 leading-snug">
              {[
                ['CheckCircle', 'Approving evidence', 'lifts readiness and records who conferred it.'],
                ['Unlock', 'Resolving a blocker', 'clears the gate and recomputes risk.'],
                ['ArrowRight', 'Advancing a stage', 'moves the record and resets its SLA clock.'],
                ['ChevronsUp', 'Escalating', 'flags for leadership and notifies the org.'],
              ].map(([icKey, b, t]) => {
                const I = Icon[icKey] || Icon.Dot;
                return (
                  <div key={b} className="flex items-start gap-2.5">
                    <span className="h-5 w-5 rounded flex items-center justify-center accent-soft-bg accent-text flex-shrink-0 mt-0.5"><I size={11} /></span>
                    <span className="text-pretty"><span className="text-slate-200 font-medium">{b}</span> {t}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── view: timeline ─────────────────────────────
function ViewTimeline() {
  const { events } = useWorkspace();
  const [typeF, setTypeF] = React.useState('all');
  const [actorF, setActorF] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [onlyManual, setOnlyManual] = React.useState(false);

  let rows = events;
  if (typeF !== 'all') rows = rows.filter((e: any) => e.type === typeF);
  if (actorF !== 'all') rows = rows.filter((e: any) => (actorF === 'system' ? !e.actor : e.actor === actorF));
  if (onlyManual) rows = rows.filter((e: any) => !e.system);
  if (q.trim()) {
    const t = q.toLowerCase();
    rows = rows.filter((e: any) => (e.subject || '').toLowerCase().includes(t) || (e.detail || '').toLowerCase().includes(t));
  }

  const groups: any[] = [];
  const dayKey = (ts: number) => new Date(ts).toDateString();
  rows.forEach((e: any) => {
    const k = dayKey(e.ts);
    let g = groups.find((x) => x.k === k);
    if (!g) {
      g = { k, ts: e.ts, items: [] };
      groups.push(g);
    }
    g.items.push(e);
  });
  const dayLabel = (ts: number) => {
    const d = new Date(ts),
      today = new Date(),
      yest = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yest.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };

  const manualCount = events.filter((e: any) => !e.system).length;
  const typeCounts: any = {};
  events.forEach((e: any) => (typeCounts[e.type] = (typeCounts[e.type] || 0) + 1));
  const topTypes = Object.entries(typeCounts).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Event Timeline · W1400-D4" title="Every action, observable and immutable" sub="The operational ledger for this organization. Each event is appended with a sequence number and frozen on write — nothing here can be edited or removed. Filter the chain to audit any record, any operator, any action."
        right={<div className="hidden md:flex items-center gap-4 border border-white/10 rounded-md px-4 py-2.5"><Stat label="Events" value={events.length} /><span className="h-8 w-px bg-white/10" /><Stat label="Operator actions" value={manualCount} color="#5ed6a4" /></div>} />

      <Panel>
        <div className="px-5 py-3 flex items-center gap-3 flex-wrap">
          <span className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">Ledger composition</span>
          <div className="flex items-center gap-2 flex-wrap">
            {topTypes.map(([t, n]: any) => {
              const ET = EVENT_TYPES[t] || {};
              const EI = Icon[ET.icon] || Icon.Dot;
              return (<span key={t} className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 bg-white/[0.03] rounded-full px-2.5 py-1 border border-white/[0.06]"><EI size={11} className="accent-text" /> {ET.label} <span className="mono text-slate-500">{n}</span></span>);
            })}
          </div>
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        <Panel className="overflow-hidden">
          <div className="px-4 py-3 border-b border-white/[0.07] flex items-center gap-2.5 flex-wrap">
            <div className="relative flex-1 min-w-[160px]">
              <Icon.Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records or details…" className="w-full h-8 pl-8 pr-3 bg-white/[0.04] border border-white/10 focus:border-white/30 rounded-md text-[12px] text-slate-100 outline-none placeholder:text-slate-600" />
            </div>
            <TSelect value={typeF} onChange={setTypeF} options={[['all', 'All types'], ...Object.entries(EVENT_TYPES).map(([k, v]: any) => [k, v.label])]} />
            <TSelect value={actorF} onChange={setActorF} options={[['all', 'All actors'], ['system', 'System / field'], ...TEAM.map((u) => [u.id, u.name])]} />
            <button onClick={() => setOnlyManual((v) => !v)} className={cn('h-8 px-2.5 rounded-md text-[11.5px] border transition-colors flex items-center gap-1.5', onlyManual ? 'accent-bg text-slate-950 border-transparent' : 'border-white/10 text-slate-300 hover:border-white/25')}>
              <Icon.User size={12} /> Operator only
            </button>
          </div>

          <div className="max-h-[680px] overflow-y-auto scroll-thin">
            {groups.length === 0 && <div className="px-5 py-12 text-center text-[13px] text-slate-500">No events match this filter.</div>}
            {groups.map((g) => (
              <div key={g.k}>
                <div className="sticky top-0 z-10 bg-[#11161e]/95 backdrop-blur px-5 py-2 border-b border-white/[0.06] flex items-center justify-between">
                  <span className="mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{dayLabel(g.ts)}</span>
                  <span className="mono text-[9.5px] text-slate-600">{g.items.length} events</span>
                </div>
                <div className="px-5 py-2">
                  {g.items.map((e: any, i: number) => (<EventRow key={e.id} e={e} last={i === g.items.length - 1} />))}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-2.5 border-t border-white/[0.06] mono text-[10px] text-slate-500 flex items-center justify-between">
            <span>{rows.length} events shown · newest first</span>
            <span className="flex items-center gap-1.5"><Icon.Lock size={11} /> append-only · frozen on write</span>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel className="overflow-hidden">
            <div className="p-5" style={{ background: 'linear-gradient(180deg, var(--accent-glow), transparent 70%)' }}>
              <span className="h-10 w-10 rounded-xl flex items-center justify-center accent-soft-bg accent-text mb-3"><Icon.Lock size={18} /></span>
              <div className="text-[14px] font-semibold text-slate-100">Why immutable</div>
              <p className="text-[11.5px] text-slate-400 mt-1.5 leading-snug text-pretty">A workforce decision is only trustworthy if you can prove how it was reached. Every action appends a frozen event with a sequence number and an actor — the record&apos;s state is always the sum of its events, and the trail can never be quietly rewritten.</p>
            </div>
            <div className="px-5 py-4 border-t border-white/[0.07] space-y-3">
              {[
                ['Hash', 'Sequenced', 'Monotonic seq per event — gaps are detectable.'],
                ['User', 'Attributed', 'Every action names the operator who took it.'],
                ['Lock', 'Append-only', 'Events are frozen; no edits, no deletes.'],
                ['Repeat', 'Replayable', 'Re-derive any state from the chain alone.'],
              ].map(([icKey, t, dsc]) => {
                const I = Icon[icKey] || Icon.Dot;
                return (
                  <div key={t} className="flex items-start gap-2.5">
                    <span className="h-6 w-6 rounded-md flex items-center justify-center accent-soft-bg accent-text flex-shrink-0"><I size={12} /></span>
                    <div><div className="text-[12px] font-medium text-slate-200">{t}</div><div className="text-[10.5px] text-slate-500 leading-snug">{dsc}</div></div>
                  </div>
                );
              })}
            </div>
          </Panel>

          <Panel>
            <PanelHead icon={Icon.Activity} title="Throughput" sub="last 24h on the ledger" />
            <div className="p-5">
              <ThroughputSpark events={events} />
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function EventRow({ e, last }: any) {
  const ET = EVENT_TYPES[e.type] || {};
  const EI = Icon[ET.icon] || Icon.Dot;
  const tone = ({ emerald: '#5ed6a4', accent: '#34d8e8', amber: '#f0a93a', rose: '#ec7a9b', slate: '#8b97a8' } as any)[ET.tone] || '#8b97a8';
  const actor = e.actor ? (TEAM.find((t) => t.id === e.actor) || {}).name : null;
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <span className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: hexA(tone, 0.14), color: tone }}><EI size={13} /></span>
        {!last && <span className="w-px flex-1 bg-white/[0.08] my-1" />}
      </div>
      <div className="min-w-0 flex-1 pb-3.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-medium text-slate-100">{ET.label || e.type}</span>
          {e.subject && <button onClick={() => openRecord(e.subjectId)} className="text-[11.5px] text-slate-400 hover:accent-text transition-colors">· {e.subject}</button>}
          {!e.actor && <Pill tone="slate">system</Pill>}
        </div>
        <div className="text-[11px] text-slate-500 mt-0.5 text-pretty">{e.detail}</div>
        <div className="flex items-center gap-2 mono text-[9.5px] text-slate-600 mt-1">
          <span className="text-slate-500">#{e.seq}</span>
          <span>·</span>
          {actor ? <span className="flex items-center gap-1"><Avatar userId={e.actor} size={13} /> {actor}</span> : <span>field / automated</span>}
          <span>·</span>
          <span>{clockTime(e.ts)} · {timeAgo(e.ts)}</span>
        </div>
      </div>
    </div>
  );
}

function ThroughputSpark({ events }: any) {
  const now = Date.now(),
    span = 2 * 3600 * 1000,
    buckets = new Array(12).fill(0);
  events.forEach((e: any) => {
    const age = now - e.ts;
    const idx = 11 - Math.floor(age / span);
    if (idx >= 0 && idx < 12) buckets[idx]++;
  });
  const max = Math.max(1, ...buckets);
  return (
    <div>
      <div className="flex items-end gap-1.5 h-[70px]">
        {buckets.map((b, i) => (<div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(4, (b / max) * 100)}%`, background: i === 11 ? 'var(--accent)' : 'var(--accent-soft)', boxShadow: 'inset 0 0 0 1px var(--accent-ring)' }} title={`${b} events`} />))}
      </div>
      <div className="flex items-center justify-between mono text-[9px] text-slate-600 mt-2">
        <span>-24h</span><span>now</span>
      </div>
    </div>
  );
}

function TSelect({ value, onChange, options }: any) {
  return (
    <div className="relative">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none h-8 pl-2.5 pr-7 bg-white/[0.04] border border-white/10 hover:border-white/20 focus:border-white/30 rounded-md text-[11.5px] text-slate-200 outline-none cursor-pointer max-w-[150px]">
        {options.map(([v, l]: any) => (<option key={v} value={v} className="bg-[#141922]">{l}</option>))}
      </select>
      <Icon.ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </div>
  );
}

// ───────────────────────────── view: executive ─────────────────────────────
function ViewExecutive() {
  const { def, roster, events, terms } = useWorkspace();
  const agg = aggregates(def, roster);

  const activations = events.filter((e: any) => e.type === 'recognition_updated' || (e.type === 'stage_advanced' && /active|in-network|on assignment/i.test(e.detail))).length;
  const accepted = events.filter((e: any) => e.type === 'offer_accepted').length;
  const targetWeekly = Math.max(6, Math.round(agg.inMotion * 0.12));
  const velocityPct = Math.min(140, Math.round(((activations + accepted) / targetWeekly) * 100));

  const stageDelay = def.stages
    .map((s: any, i: number) => {
      const inStage = roster.filter((p: any) => p.stageIdx === i);
      const over = inStage.filter((p: any) => p.overdue);
      const avgOver = over.length ? Math.round(over.reduce((a: number, p: any) => a + (p.daysInStage - p.sla), 0) / over.length) : 0;
      return { label: s.label, idx: i, total: inStage.length, over: over.length, avgOver, sla: s.sla };
    })
    .filter((s: any) => s.sla > 0)
    .sort((a: any, b: any) => b.over - a.over);
  const worstStage = stageDelay[0];

  const groups = agg.groups.map((g: any) => ({ ...g, riskPct: g.motion ? Math.round((g.risk / g.motion) * 100) : 0 })).sort((a: any, b: any) => b.risk - a.risk || b.motion - a.motion);
  const atRiskGroups = groups.filter((g: any) => g.risk > 0);

  const nearly = roster.filter((p: any) => !p.isActive && p.readiness >= 85).map((p: any) => ({ ...p, score: priorityScore(p) })).sort((a: any, b: any) => b.readiness - a.readiness);

  const attention = roster.map((p: any) => ({ ...p, score: priorityScore(p) })).filter((p: any) => p.flagged || p.score >= 70).sort((a: any, b: any) => b.score - a.score);

  return (
    <div className="max-w-[1560px] mx-auto px-6 py-7 space-y-6">
      <SurfaceIntro eyebrow="Executive View · W1400-D5" title={`${def.short} — the view from leadership`} sub={`Five questions, answered from live operations. No spreadsheets, no status meetings — the same events the team works produce the picture leadership sees.`} right={<div className="hidden md:flex items-center gap-2 mono text-[10px] uppercase tracking-[0.12em] text-slate-500 border border-white/10 rounded-md px-3 py-2"><Icon.Award size={13} className="accent-text" /> {def.type}</div>} />

      <Panel className="rise overflow-hidden">
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-x divide-white/[0.06]" style={{ background: 'linear-gradient(180deg, var(--accent-glow), transparent 80%)' }}>
          <BigStat label="Hiring velocity" value={velocityPct + '%'} sub="of weekly target" tone={velocityPct >= 100 ? '#5ed6a4' : velocityPct >= 75 ? '#f0a93a' : '#ec7a9b'} />
          <BigStat label="Workforce readiness" value={agg.readinessAvg + '%'} sub={`${agg.inMotion} in motion`} tone={agg.readinessAvg >= 75 ? '#5ed6a4' : '#f0a93a'} />
          <BigStat label="Groups at risk" value={atRiskGroups.length} sub={`of ${groups.length} ${terms.groupPl.toLowerCase()}`} tone={atRiskGroups.length === 0 ? '#5ed6a4' : '#ec7a9b'} />
          <BigStat label="Needs attention" value={attention.length} sub="leadership decisions" tone={attention.length === 0 ? '#5ed6a4' : '#ec7a9b'} />
        </div>
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuestionCard n="01" q="Are we hiring fast enough?" verdict={velocityPct >= 100 ? { t: 'On pace', tone: 'emerald' } : velocityPct >= 75 ? { t: 'Slightly behind', tone: 'amber' } : { t: 'Behind target', tone: 'rose' }}>
          <div className="flex items-center gap-5">
            <Ring2 value={Math.min(100, velocityPct)} label={velocityPct + '%'} tone={velocityPct >= 100 ? '#5ed6a4' : velocityPct >= 75 ? '#f0a93a' : '#ec7a9b'} />
            <div className="space-y-2 text-[12px] flex-1">
              <ExecRow label="Activations & accepts logged" value={activations + accepted} />
              <ExecRow label="Weekly target" value={targetWeekly} />
              <ExecRow label="In-motion pipeline" value={agg.inMotion} />
              <ExecRow label="Nearly ready to add" value={agg.nearlyReady} c="#5ed6a4" />
            </div>
          </div>
        </QuestionCard>

        <QuestionCard n="02" q="Where are delays occurring?" verdict={worstStage && worstStage.over > 0 ? { t: worstStage.label, tone: 'rose' } : { t: 'No SLA breaches', tone: 'emerald' }}>
          <div className="space-y-2.5">
            {stageDelay.slice(0, 5).map((s: any) => (
              <div key={s.idx}>
                <div className="flex items-center justify-between text-[11.5px] mb-1">
                  <span className="text-slate-300 truncate">{s.label}</span>
                  <span className="mono text-slate-500">{s.over > 0 ? <span className="text-rose-300">{s.over} over · +{s.avgOver}d avg</span> : <span className="text-emerald-300">on time</span>}</span>
                </div>
                <Bar value={s.over} max={Math.max(1, ...stageDelay.map((x: any) => x.over), s.total)} color={s.over > 0 ? '#ec7a9b' : '#5ed6a4'} h={4} />
              </div>
            ))}
            {stageDelay.length === 0 && <div className="text-[12px] text-slate-500">No timed stages in this pipeline.</div>}
          </div>
        </QuestionCard>

        <QuestionCard n="03" q={`Which ${terms.groupPl.toLowerCase()} are at risk?`} verdict={atRiskGroups.length ? { t: `${atRiskGroups.length} flagged`, tone: 'rose' } : { t: 'All healthy', tone: 'emerald' }}>
          <div className="space-y-2">
            {groups.slice(0, 6).map((g: any) => (
              <div key={g.group} className="flex items-center gap-3">
                <span className="w-2 flex-shrink-0">{g.risk > 0 && <RiskDot risk="high" size={7} />}</span>
                <span className="text-[12px] text-slate-200 flex-1 min-w-0 truncate">{g.group}</span>
                <span className="mono text-[10.5px] text-slate-500">{g.motion} in motion</span>
                <span className="w-16 text-right mono text-[11px] tabular-nums" style={{ color: g.risk > 0 ? '#ec7a9b' : '#5ed6a4' }}>{g.risk > 0 ? `${g.risk} risk` : 'clear'}</span>
              </div>
            ))}
          </div>
        </QuestionCard>

        <QuestionCard n="04" q="Which records are nearly ready?" verdict={{ t: `${nearly.length} ready soon`, tone: nearly.length ? 'emerald' : 'slate' }}>
          <div className="space-y-1.5 max-h-[210px] overflow-y-auto scroll-thin">
            {nearly.length === 0 && <div className="text-[12px] text-slate-500">None above 85% yet.</div>}
            {nearly.slice(0, 8).map((p: any) => (
              <button key={p.id} onClick={() => openRecord(p.id)} className="w-full flex items-center gap-3 text-left hover:bg-white/[0.03] rounded-md px-2 py-1.5 -mx-2 transition-colors group">
                <span className="text-[12px] font-medium text-slate-200 flex-1 min-w-0 truncate group-hover:accent-text transition-colors">{p.name}</span>
                <span className="mono text-[10px] text-slate-500 truncate hidden sm:block">{def.stages[p.stageIdx].label}</span>
                <span className="w-20"><Bar value={p.readiness} color="#5ed6a4" h={4} /></span>
                <span className="mono text-[11px] tabular-nums text-emerald-300 w-9 text-right">{p.readiness}%</span>
              </button>
            ))}
          </div>
        </QuestionCard>
      </div>

      <Panel className="overflow-hidden">
        <PanelHead icon={Icon.Siren} title="What requires leadership attention?" sub="escalations and P1 records — resolve or delegate today" right={<Pill tone={attention.length ? 'rose' : 'emerald'}>{attention.length} items</Pill>} />
        {attention.length === 0 ? (
          <div className="px-5 py-10 text-center text-[13px] text-slate-500">Nothing needs leadership right now. The team has it.</div>
        ) : (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-px bg-white/[0.05]">
            {attention.slice(0, 9).map((p: any) => {
              const reason = p.flagged
                ? 'Escalated to leadership'
                : p.blockers.length
                  ? (BLOCKERS.find((b) => b.id === p.blockers[0]) || {}).label
                  : p.overdue
                    ? `${p.daysInStage - p.sla}d past SLA`
                    : `Readiness ${p.readiness}%`;
              return (
                <button key={p.id} onClick={() => openRecord(p.id)} className="bg-[#141922] hover:bg-[#171d27] transition-colors p-4 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0"><RiskDot risk={p.risk} /><span className="text-[12.5px] font-medium text-slate-100 truncate">{p.name}</span></div>
                    <PriorityTag score={p.score} />
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1.5 truncate">{reason}</div>
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="mono text-[10px] text-slate-500">{def.stages[p.stageIdx].label}</span>
                    <span className="inline-flex items-center gap-1 text-[10.5px] accent-text">Open <Icon.ArrowUpRight size={11} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
        <div className="px-5 py-2.5 border-t border-white/[0.06] flex items-center justify-between">
          <span className="mono text-[10px] text-slate-500">routed from the same ledger the team works</span>
          <Button size="xs" variant="dark" iconRight={<Icon.ArrowRight size={12} />} onClick={() => navTo('command')}>Go to Command</Button>
        </div>
      </Panel>
    </div>
  );
}

function BigStat({ label, value, sub, tone }: any) {
  return (
    <div className="px-5 py-5">
      <div className="mono text-[9.5px] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="text-[34px] font-semibold tabular-nums leading-none mt-2" style={{ color: tone }}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-1.5">{sub}</div>
    </div>
  );
}
function QuestionCard({ n, q, verdict, children }: any) {
  const v = verdict || {};
  const tone = ({ emerald: 'emerald', amber: 'amber', rose: 'rose', slate: 'slate' } as any)[v.tone] || 'slate';
  return (
    <Panel className="overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.07] flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="mono text-[11px] accent-text mt-0.5">{n}</span>
          <h3 className="text-[15px] font-semibold text-slate-100 tracking-[-0.01em] leading-snug">{q}</h3>
        </div>
        {v.t && <Pill tone={tone}>{v.t}</Pill>}
      </div>
      <div className="p-5">{children}</div>
    </Panel>
  );
}
function ExecRow({ label, value, c }: any) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="mono tabular-nums font-medium" style={{ color: c || '#e6ecf3' }}>{value}</span>
    </div>
  );
}
function Ring2({ value, label, tone, size = 92 }: any) {
  const r = (size - 12) / 2,
    c = 2 * Math.PI * r,
    off = c * (1 - value / 100);
  return (
    <svg width={size} height={size} className="flex-shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.7,.2,1)' }} />
      <text x="50%" y="50%" dy="0.34em" textAnchor="middle" className="rotate-90 mono" style={{ transformOrigin: 'center', fill: tone, fontSize: 19, fontWeight: 600 }}>{label}</text>
    </svg>
  );
}

// ───────────────────────────── root app ─────────────────────────────
const VIEW_FOR: Record<string, any> = {
  operations: ViewOperations,
  queues: ViewQueues,
  command: ViewCommand,
  timeline: ViewTimeline,
  executive: ViewExecutive,
};

let _hbStarted = false;

const SCOPED_CSS = `
.w14 {
  --accent: #34d8e8;
  --accent-soft: rgba(52,216,232,0.12);
  --accent-ring: rgba(52,216,232,0.3);
  --accent-glow: rgba(52,216,232,0.06);
  background: #0b0e13;
  color: #e6ecf3;
  font-family: var(--vt-font-body, 'Geist', ui-sans-serif, system-ui, sans-serif);
  font-feature-settings: 'ss01','cv11';
  -webkit-font-smoothing: antialiased;
}
.w14 .mono { font-family: var(--font-geist-mono, 'Geist Mono', ui-monospace, SFMono-Regular, monospace); font-variant-numeric: tabular-nums; }
.w14 time, .w14 code, .w14 kbd, .w14 samp { font-variant-numeric: tabular-nums; }
.w14 .text-pretty { text-wrap: pretty; }
.w14 ::selection { background: var(--accent); color: #08121a; }
.w14 .accent-bg { background: var(--accent); }
.w14 .accent-text { color: var(--accent); }
.w14 .accent-soft-bg { background: var(--accent-soft); }
.w14 .accent-ring { box-shadow: inset 0 0 0 1px var(--accent-ring); }
.w14 .accent-border { border-color: var(--accent-ring); }
.w14 .accent-bg:hover { filter: brightness(1.08); }
.w14 .blink { animation: w14blink 2.4s ease-in-out infinite; }
.w14 .pulse-soft { animation: w14pulse 1.8s ease-in-out infinite; }
@media (prefers-reduced-motion: no-preference) { .w14 .rise { animation: w14rise .45s cubic-bezier(.2,.7,.2,1) both; } }
.w14 .scroll-thin::-webkit-scrollbar { height: 8px; width: 8px; }
.w14 .scroll-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 8px; }
.w14 .scroll-thin::-webkit-scrollbar-track { background: transparent; }
.w14 ::-webkit-scrollbar { width: 11px; height: 11px; }
.w14 ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 8px; border: 3px solid #0b0e13; }
.w14 ::-webkit-scrollbar-track { background: transparent; }
`;

export default function OpsEngineClient({ liveSnapshot = null }: { liveSnapshot?: OpsSnapshot | null }) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const initedRef = React.useRef(false);
  // Swap the dataset to real data before any hook reads the Store. One-time,
  // synchronous; the demo path leaves the module defaults untouched.
  if (liveSnapshot && liveSnapshot.status === 'live' && !initedRef.current) {
    __loadLive(liveSnapshot);
    initedRef.current = true;
  } else if (!liveSnapshot) {
    __loadDemo();
  }

  const { surface } = useRoute();
  const { accent, def } = useWorkspace();
  useAccentTheme(accent, rootRef);

  React.useEffect(() => {
    if (!window.location.hash) window.location.replace('#/operations');
  }, []);
  React.useEffect(() => {
    if (!LIVE && !_hbStarted) {
      _hbStarted = true;
      startHeartbeat();
    }
  }, []);
  // Live mode: poll the snapshot for a real-time feel (no synthetic heartbeat).
  React.useEffect(() => {
    if (!LIVE) return;
    const t = setInterval(async () => {
      const snap = await fetchLiveSnapshot();
      if (snap) refreshLive(snap);
    }, 20000);
    return () => clearInterval(t);
  }, []);

  const View = VIEW_FOR[surface] || ViewOperations;
  return (
    <div ref={rootRef} className="w14 min-h-screen">
      <style>{SCOPED_CSS}</style>
      <TopChrome surface={surface} />
      <main className="pb-16">
        <View />
      </main>
      <RecordDrawer />
      <footer className="border-t border-white/[0.07]">
        <div className="max-w-[1560px] mx-auto px-6 py-5 flex items-center justify-between flex-wrap gap-3 mono text-[10px] uppercase tracking-[0.12em] text-slate-600">
          <span>VitalCV · Operations Engine · Wave 1400</span>
          <span className="hidden md:inline">{def.name}</span>
          <span>vc.2026.06.27 · w1400 · v1</span>
        </div>
      </footer>
    </div>
  );
}
