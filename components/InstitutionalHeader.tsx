"use client";

import Image from "next/image";
import { useState } from "react";
import {
  DEFAULT_LEFT_LOGO_SRC,
  DEFAULT_RIGHT_LOGO_SRC,
  REMOVED_IMAGE_SOURCE,
} from "@/lib/certificateEvents";

type LogoSlotProps = {
  src: string;
  alt: string;
  fallback: string;
  align: "left" | "right";
};

function LogoSlot({ src, alt, fallback, align }: LogoSlotProps) {
  const [failedSrc, setFailedSrc] = useState("");
  const missing = src === REMOVED_IMAGE_SOURCE || failedSrc === src;

  return (
    <div className={`logo-slot logo-slot-${align}`} aria-hidden={missing}>
      {missing ? (
        <div className="logo-placeholder">{fallback}</div>
      ) : (
        <Image
          src={src}
          alt={alt}
          width={82}
          height={82}
          className="institution-logo"
          unoptimized
          onError={() => setFailedSrc(src)}
        />
      )}
    </div>
  );
}

type InstitutionalHeaderProps = {
  leftLogoSrc?: string;
  rightLogoSrc?: string;
};

export default function InstitutionalHeader({
  leftLogoSrc = DEFAULT_LEFT_LOGO_SRC,
  rightLogoSrc = DEFAULT_RIGHT_LOGO_SRC,
}: InstitutionalHeaderProps) {
  return (
    <header className="institutional-header">
      <LogoSlot
        src={leftLogoSrc}
        alt="Yashwantrao Bhonsale Institute of Technology logo"
        fallback="YBIT"
        align="left"
      />

      <div className="institutional-copy">
        <p className="society-name">
          Shri Yashwantrao Bhonsale Education Society&apos;s
        </p>
        <p className="institute-name">
          YASHWANTRAO BHONSALE INSTITUTE OF TECHNOLOGY
        </p>
        <p className="dte-code">(DTE CODE : 3470)</p>
        <p className="affiliation">
          Approved by AICTE, DTE &amp; Affiliated to Mumbai University
        </p>
      </div>

      <LogoSlot
        src={rightLogoSrc}
        alt="University of Mumbai logo"
        fallback="MU"
        align="right"
      />
    </header>
  );
}
