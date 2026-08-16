"use client";

import Image from "next/image";
import { useState } from "react";

type LogoSlotProps = {
  src: string;
  alt: string;
  fallback: string;
  align: "left" | "right";
};

function LogoSlot({ src, alt, fallback, align }: LogoSlotProps) {
  const [missing, setMissing] = useState(false);

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
          onError={() => setMissing(true)}
        />
      )}
    </div>
  );
}

export default function InstitutionalHeader() {
  return (
    <header className="institutional-header">
      <LogoSlot
        src="/ybit-logo.png"
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
        src="/mumbai-university-logo.png"
        alt="University of Mumbai logo"
        fallback="MU"
        align="right"
      />
    </header>
  );
}
