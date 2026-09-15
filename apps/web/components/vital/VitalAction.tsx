import * as React from 'react';
import Link from 'next/link';

/**
 * VitalAction — the one primary action (D-02, founder decision 2).
 *
 * The warm-paper inverse: paper fill with dark ink on the dark scene register,
 * ink fill with paper text on a paper band. Full pill (decision 4). Green is
 * never an action colour — it belongs to source-confirmed / completed-work
 * states, and this component cannot reach it: every colour routes through
 * the `--vt-action-primary-*` state ladder (styles/themes/index.css), whose
 * contract test pins the values away from the state hues and pins hover
 * strictly between rest and press.
 *
 * `label` is a STRING by design, not children. An action that accepts
 * arbitrary children eventually swallows a nested link or button, and a
 * control inside a control is unannounceable. With a string label the
 * nested-interactive defect is unrepresentable rather than linted.
 *
 * Pending is a STATE, not an animation (EC-3: no movement means no new
 * state). A pending action announces `aria-busy`, disables itself, and shows
 * the caller-supplied `pendingLabel` — the caller must say what is actually
 * happening ("Checking the registry…"), because a generic spinner is exactly
 * the certainty-theatre the truth contract bans.
 */
export type VitalActionProps = {
  label: string;
  /** Which side of the paper/ink inversion the action sits on. */
  register?: 'scene' | 'paper';
  size?: 'md' | 'lg';
  /** Renders a Next <Link> when present; a <button> otherwise. */
  href?: string;
  type?: 'button' | 'submit';
  disabled?: boolean;
  /** The honest in-progress wording. Required to enter the pending state. */
  pendingLabel?: string;
  pending?: boolean;
  onClick?: React.MouseEventHandler<HTMLElement>;
  className?: string;
  'data-testid'?: string;
};

const SIZE: Record<'md' | 'lg', string> = {
  md: 'h-10 px-[18px] text-[13px]',
  lg: 'h-12 px-[22px] text-[14px]',
};

/**
 * The five-state ladder, one token per state per side (styles/themes/index.css,
 * "Component-state ladder"). The component names a STATE and never a surface:
 * rest → hover → focus → press → disabled. Tailwind v4 orders these variants
 * hover < focus-visible < active < disabled, so press beats hover and
 * disabled beats everything; the focus fill equals rest by contract (the
 * indigo ring carries focus, EC-5), so a keyboard-focused button that is also
 * hovered paints its rest fill under the ring.
 */
const REGISTER: Record<'scene' | 'paper', string> = {
  scene:
    'bg-[var(--vt-action-primary-bg-rest)] text-[var(--vt-action-primary-fg-rest)] ' +
    'hover:bg-[var(--vt-action-primary-bg-hover)] hover:text-[var(--vt-action-primary-fg-hover)] ' +
    'focus-visible:bg-[var(--vt-action-primary-bg-focus)] focus-visible:text-[var(--vt-action-primary-fg-focus)] ' +
    'active:bg-[var(--vt-action-primary-bg-press)] active:text-[var(--vt-action-primary-fg-press)] ' +
    'disabled:bg-[var(--vt-action-primary-bg-disabled)] disabled:text-[var(--vt-action-primary-fg-disabled)] ' +
    'focus-visible:outline-[var(--vt-focus-ring-scene)]',
  paper:
    'bg-[var(--vt-action-primary-inverse-bg-rest)] text-[var(--vt-action-primary-inverse-fg-rest)] ' +
    'hover:bg-[var(--vt-action-primary-inverse-bg-hover)] hover:text-[var(--vt-action-primary-inverse-fg-hover)] ' +
    'focus-visible:bg-[var(--vt-action-primary-inverse-bg-focus)] focus-visible:text-[var(--vt-action-primary-inverse-fg-focus)] ' +
    'active:bg-[var(--vt-action-primary-inverse-bg-press)] active:text-[var(--vt-action-primary-inverse-fg-press)] ' +
    'disabled:bg-[var(--vt-action-primary-inverse-bg-disabled)] disabled:text-[var(--vt-action-primary-inverse-fg-disabled)] ' +
    'focus-visible:outline-[var(--vt-focus-ring-scene-paper)]',
};

export function VitalAction({
  label,
  register = 'scene',
  size = 'md',
  href,
  type = 'button',
  disabled = false,
  pending = false,
  pendingLabel,
  onClick,
  className,
  'data-testid': testId,
}: VitalActionProps) {
  const showPending = pending && Boolean(pendingLabel);
  const text = showPending ? pendingLabel : label;
  const shared =
    'inline-flex items-center justify-center whitespace-nowrap rounded-full font-semibold leading-none ' +
    // Control-feedback band (80–150ms, EC-29) on the one house curve.
    'cursor-pointer transition-colors duration-[var(--duration-instant)] ease-[var(--vt-ease-system)] ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ' +
    'disabled:cursor-default ' +
    `${SIZE[size]} ${REGISTER[register]} ${className ?? ''}`;

  if (href && !disabled && !pending) {
    return (
      <Link href={href} className={shared} onClick={onClick} data-testid={testId}>
        {text}
      </Link>
    );
  }

  return (
    <button
      type={type}
      className={shared}
      disabled={disabled || pending}
      aria-busy={showPending || undefined}
      onClick={onClick}
      data-testid={testId}
    >
      {text}
    </button>
  );
}
