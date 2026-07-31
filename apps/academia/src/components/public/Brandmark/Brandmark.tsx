import Image from 'next/image';
import {
  BRAND_LOCKUP,
  BRAND_MARK,
  BRAND_NAME,
  BRAND_NAME_SHORT,
  DESCRIPTOR_TREATMENT,
} from '@/lib/brand';
import styles from './Brandmark.module.css';

export interface BrandmarkProps {
  /** Which surface it sits on: picks the sand/green asset variant. */
  tone?: 'onDark' | 'onLight';
  /** Rendered height in px. The mark is a raster; width follows the 947:207 ratio. */
  height?: number;
  /** Above-the-fold instances (the navbar) should preload. */
  priority?: boolean;
  className?: string;
}

/**
 * The ONLY place in the app that renders the brand. Every screen goes through
 * here, which is what makes D-1 (the lockup) and D-2 (the descriptor treatment)
 * one-value edits in @/lib/brand instead of a hunt across a dozen files.
 *
 * It also decides nothing itself: both open decisions are read from that module.
 */
export function Brandmark({
  tone = 'onDark',
  height = 40,
  priority = false,
  className,
}: BrandmarkProps) {
  const baked = DESCRIPTOR_TREATMENT === 'baked-lockup';
  const asset = baked ? BRAND_LOCKUP : BRAND_MARK;
  const width = Math.round((asset.width / asset.height) * height);

  return (
    <span className={[styles.brandmark, className].filter(Boolean).join(' ')}>
      <Image
        src={asset[tone]}
        // With the baked lockup the image IS the full name; with live text the
        // image is the mark and the descriptor supplies the rest, so the alt text
        // must not duplicate it.
        alt={baked ? BRAND_NAME : 'Zephyra'}
        width={width}
        height={height}
        priority={priority}
        className={styles.mark}
        style={{ height: `${height}px`, width: 'auto' }}
      />
      {baked ? null : (
        <span className={tone === 'onDark' ? styles.descriptorOnDark : styles.descriptor}>
          {BRAND_NAME_SHORT}
        </span>
      )}
    </span>
  );
}
