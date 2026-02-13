const BROWN = '#3C2415';
const GOLD = '#C5A572';

function EthiopiaYirgacheffe() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* V60 Dripper */}
      <path
        d="M95 130 L120 80 L145 130"
        stroke={BROWN}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <ellipse cx="120" cy="130" rx="25" ry="4" stroke={BROWN} strokeWidth="1.5" fill="none" />
      <line x1="120" y1="134" x2="120" y2="150" stroke={BROWN} strokeWidth="1.5" />

      {/* Server/Carafe */}
      <path
        d="M100 150 Q100 170 108 175 L132 175 Q140 170 140 150"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="120" cy="150" rx="20" ry="3" stroke={BROWN} strokeWidth="1" fill="none" />

      {/* Base */}
      <ellipse cx="120" cy="178" rx="18" ry="3" stroke={BROWN} strokeWidth="1" fill="none" />

      {/* Steam with floral tips */}
      <path
        d="M110 78 Q105 60 112 45 Q115 38 110 30"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M120 76 Q120 55 118 42 Q117 35 120 25"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
      <path
        d="M130 78 Q135 60 128 45 Q125 38 130 30"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Jasmine flowers at steam tips */}
      <g transform="translate(108, 24)" opacity="0.7">
        <circle cx="0" cy="0" r="2" fill={GOLD} />
        <circle cx="0" cy="-4" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="-3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
      </g>
      <g transform="translate(120, 19)" opacity="0.7">
        <circle cx="0" cy="0" r="2" fill={GOLD} />
        <circle cx="0" cy="-4" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="-3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
      </g>
      <g transform="translate(132, 24)" opacity="0.7">
        <circle cx="0" cy="0" r="2" fill={GOLD} />
        <circle cx="0" cy="-4" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="-3.5" cy="-1.5" r="2.5" fill={GOLD} opacity="0.5" />
      </g>

      {/* Citrus slices */}
      <g transform="translate(75, 55)" opacity="0.4">
        <circle cx="0" cy="0" r="8" stroke={GOLD} strokeWidth="1" fill="none" />
        <line x1="-5" y1="0" x2="5" y2="0" stroke={GOLD} strokeWidth="0.5" />
        <line x1="0" y1="-5" x2="0" y2="5" stroke={GOLD} strokeWidth="0.5" />
        <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke={GOLD} strokeWidth="0.5" />
        <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke={GOLD} strokeWidth="0.5" />
      </g>
      <g transform="translate(165, 70)" opacity="0.35">
        <circle cx="0" cy="0" r="6" stroke={GOLD} strokeWidth="1" fill="none" />
        <line x1="-4" y1="0" x2="4" y2="0" stroke={GOLD} strokeWidth="0.5" />
        <line x1="0" y1="-4" x2="0" y2="4" stroke={GOLD} strokeWidth="0.5" />
      </g>

      {/* Brightness radiating dashes */}
      <g opacity="0.3" stroke={BROWN} strokeWidth="0.8" strokeLinecap="round">
        <line x1="80" y1="85" x2="75" y2="82" />
        <line x1="160" y1="85" x2="165" y2="82" />
        <line x1="85" y1="105" x2="78" y2="105" />
        <line x1="155" y1="105" x2="162" y2="105" />
      </g>
    </svg>
  );
}

function ColombiaSupremo() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* Mountains background */}
      <g opacity="0.2">
        <path d="M30 120 L80 55 L130 120" fill={BROWN} />
        <path d="M70 120 L120 45 L170 120" fill={BROWN} opacity="0.7" />
        <path d="M110 120 L155 60 L200 120" fill={BROWN} opacity="0.5" />
      </g>

      {/* Sunrise arc */}
      <path
        d="M65 50 Q120 15 175 50"
        stroke={GOLD}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
        strokeLinecap="round"
      />
      <g opacity="0.15">
        <line x1="120" y1="22" x2="120" y2="15" stroke={GOLD} strokeWidth="0.8" />
        <line x1="100" y1="28" x2="96" y2="22" stroke={GOLD} strokeWidth="0.8" />
        <line x1="140" y1="28" x2="144" y2="22" stroke={GOLD} strokeWidth="0.8" />
      </g>

      {/* Coffee cup - tulip shape */}
      <path
        d="M96 120 Q92 145 100 158 L140 158 Q148 145 144 120"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="120" cy="120" rx="24" ry="5" stroke={BROWN} strokeWidth="1.5" fill="none" />

      {/* Coffee surface */}
      <ellipse cx="120" cy="120" rx="20" ry="3.5" fill={BROWN} opacity="0.1" />

      {/* Handle */}
      <path
        d="M144 128 Q160 130 160 140 Q160 150 144 152"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Saucer */}
      <ellipse cx="120" cy="162" rx="32" ry="5" stroke={BROWN} strokeWidth="1.5" fill="none" />

      {/* Steam */}
      <path
        d="M112 115 Q108 100 114 90"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M128 115 Q132 100 126 90"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        strokeLinecap="round"
        opacity="0.5"
      />

      {/* Coffee beans */}
      <g transform="translate(78, 168)" opacity="0.4">
        <ellipse cx="0" cy="0" rx="5" ry="3.5" stroke={BROWN} strokeWidth="1" fill="none" transform="rotate(-20)" />
        <path d="M-2,-3 Q0,0 -2,3" stroke={BROWN} strokeWidth="0.5" transform="rotate(-20)" />
      </g>
      <g transform="translate(162, 168)" opacity="0.4">
        <ellipse cx="0" cy="0" rx="5" ry="3.5" stroke={BROWN} strokeWidth="1" fill="none" transform="rotate(20)" />
        <path d="M-2,-3 Q0,0 -2,3" stroke={BROWN} strokeWidth="0.5" transform="rotate(20)" />
      </g>
    </svg>
  );
}

function GuatemalaAntigua() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* Volcano background */}
      <path
        d="M50 165 L120 40 L190 165"
        stroke={BROWN}
        strokeWidth="1"
        fill={BROWN}
        opacity="0.08"
        strokeLinejoin="round"
      />
      {/* Crater */}
      <path
        d="M108 48 L120 40 L132 48"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      {/* Volcano smoke */}
      <path
        d="M120 38 Q118 28 122 20"
        stroke={BROWN}
        strokeWidth="0.8"
        fill="none"
        opacity="0.25"
        strokeLinecap="round"
      />
      <path
        d="M122 20 Q126 12 120 8"
        stroke={BROWN}
        strokeWidth="0.8"
        fill="none"
        opacity="0.15"
        strokeLinecap="round"
      />

      {/* Moka Pot - body */}
      <path
        d="M100 165 L104 120 L136 120 L140 165"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Moka Pot - waist */}
      <path
        d="M104 120 Q120 115 136 120"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
      />
      {/* Moka Pot - upper chamber */}
      <path
        d="M106 120 L110 90 L130 90 L134 120"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      {/* Moka Pot - top/lid */}
      <path
        d="M110 90 Q120 85 130 90"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
      />
      <line x1="120" y1="85" x2="120" y2="78" stroke={BROWN} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="120" cy="76" r="3" stroke={BROWN} strokeWidth="1.5" fill="none" />

      {/* Handle */}
      <path
        d="M100 125 Q85 128 85 142 Q85 156 100 160"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Steam from spout */}
      <path
        d="M120 74 Q115 65 120 56"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.5"
        strokeLinecap="round"
      />
      <path
        d="M120 56 Q125 50 120 44"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.35"
        strokeLinecap="round"
      />

      {/* Cocoa pods */}
      <g transform="translate(60, 158)" opacity="0.3">
        <ellipse cx="0" cy="0" rx="8" ry="4" stroke={GOLD} strokeWidth="1" fill="none" transform="rotate(-15)" />
        <line x1="-5" y1="0" x2="5" y2="0" stroke={GOLD} strokeWidth="0.5" transform="rotate(-15)" />
      </g>
      <g transform="translate(180, 158)" opacity="0.3">
        <ellipse cx="0" cy="0" rx="8" ry="4" stroke={GOLD} strokeWidth="1" fill="none" transform="rotate(15)" />
        <line x1="-5" y1="0" x2="5" y2="0" stroke={GOLD} strokeWidth="0.5" transform="rotate(15)" />
      </g>

      {/* Spice diamonds */}
      <g opacity="0.2" fill={GOLD}>
        <rect x="148" y="72" width="4" height="4" transform="rotate(45 150 74)" />
        <rect x="158" y="82" width="3" height="3" transform="rotate(45 159.5 83.5)" />
        <rect x="88" y="75" width="3.5" height="3.5" transform="rotate(45 89.75 76.75)" />
      </g>

      {/* Base line */}
      <line x1="90" y1="170" x2="150" y2="170" stroke={BROWN} strokeWidth="1" opacity="0.3" />
    </svg>
  );
}

function KenyaAA() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* Geometric border pattern - left side */}
      <g opacity="0.2" stroke={GOLD} strokeWidth="1">
        <path d="M35 40 L45 55 L35 70 L45 85 L35 100 L45 115 L35 130 L45 145 L35 160" fill="none" />
        <path d="M40 40 L50 55 L40 70 L50 85 L40 100 L50 115 L40 130 L50 145 L40 160" fill="none" />
      </g>

      {/* Geometric border pattern - bottom */}
      <g opacity="0.15" stroke={GOLD} strokeWidth="1">
        <path d="M60 175 L75 165 L90 175 L105 165 L120 175 L135 165 L150 175 L165 165 L180 175" fill="none" />
      </g>

      {/* Chemex body - hourglass shape */}
      <path
        d="M100 60 L92 110 L92 115 Q92 120 100 125 L100 165"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M150 60 L158 110 L158 115 Q158 120 150 125 L150 165"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />

      {/* Chemex top opening */}
      <ellipse cx="125" cy="60" rx="25" ry="5" stroke={BROWN} strokeWidth="1.5" fill="none" />

      {/* Chemex bottom */}
      <ellipse cx="125" cy="165" rx="25" ry="4" stroke={BROWN} strokeWidth="1.5" fill="none" />

      {/* Wooden collar */}
      <rect x="114" y="108" width="22" height="14" rx="2" stroke={BROWN} strokeWidth="1.2" fill="none" />
      {/* Collar tie */}
      <path
        d="M125 108 L125 122"
        stroke={BROWN}
        strokeWidth="0.8"
        opacity="0.5"
      />

      {/* Coffee drip */}
      <line x1="125" y1="125" x2="125" y2="135" stroke={BROWN} strokeWidth="1" opacity="0.4" strokeLinecap="round" />
      <circle cx="125" cy="138" r="1.5" fill={BROWN} opacity="0.3" />

      {/* Filter cone visible at top */}
      <path
        d="M105 62 L125 85 L145 62"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.4"
        strokeDasharray="3 2"
      />

      {/* Berry clusters */}
      <g transform="translate(175, 85)" opacity="0.4">
        <circle cx="0" cy="0" r="3" fill={GOLD} opacity="0.5" />
        <circle cx="5" cy="-3" r="2.5" fill={GOLD} opacity="0.4" />
        <circle cx="-4" cy="-4" r="2.5" fill={GOLD} opacity="0.4" />
        <circle cx="2" cy="-7" r="2" fill={GOLD} opacity="0.3" />
        <circle cx="-2" cy="4" r="2" fill={GOLD} opacity="0.3" />
      </g>
      <g transform="translate(68, 100)" opacity="0.35">
        <circle cx="0" cy="0" r="2.5" fill={GOLD} opacity="0.5" />
        <circle cx="4" cy="-2" r="2" fill={GOLD} opacity="0.4" />
        <circle cx="-3" cy="-3" r="2" fill={GOLD} opacity="0.4" />
      </g>

      {/* Steam */}
      <path
        d="M118 55 Q114 40 119 30"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      <path
        d="M132 55 Q136 40 131 30"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BrazilSantos() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* Tropical leaves - upper left */}
      <g transform="translate(55, 50)" opacity="0.15">
        <path
          d="M0 40 Q-15 20 -5 0 Q5 20 0 40"
          stroke={BROWN}
          strokeWidth="1.2"
          fill={BROWN}
          opacity="0.3"
        />
        <line x1="0" y1="0" x2="0" y2="40" stroke={BROWN} strokeWidth="0.6" />
        <path d="M0 10 Q-8 5 -12 0" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 10 Q8 5 12 0" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 20 Q-10 15 -14 8" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 20 Q10 15 14 8" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 30 Q-8 25 -12 20" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 30 Q8 25 12 20" stroke={BROWN} strokeWidth="0.5" fill="none" />
      </g>

      {/* Tropical leaves - lower right */}
      <g transform="translate(185, 130) rotate(180)" opacity="0.12">
        <path
          d="M0 40 Q-15 20 -5 0 Q5 20 0 40"
          stroke={BROWN}
          strokeWidth="1.2"
          fill={BROWN}
          opacity="0.3"
        />
        <line x1="0" y1="0" x2="0" y2="40" stroke={BROWN} strokeWidth="0.6" />
        <path d="M0 10 Q-8 5 -12 0" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 10 Q8 5 12 0" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 20 Q-10 15 -14 8" stroke={BROWN} strokeWidth="0.5" fill="none" />
        <path d="M0 20 Q10 15 14 8" stroke={BROWN} strokeWidth="0.5" fill="none" />
      </g>

      {/* Portafilter - basket (top-down view) */}
      <circle cx="120" cy="110" r="30" stroke={BROWN} strokeWidth="1.5" fill="none" />
      <circle cx="120" cy="110" r="25" stroke={BROWN} strokeWidth="1" fill="none" opacity="0.5" />

      {/* Crema surface */}
      <circle cx="120" cy="110" r="23" fill={GOLD} opacity="0.15" />

      {/* Rosetta pattern in crema */}
      <g opacity="0.25" stroke={BROWN} strokeWidth="0.8" fill="none">
        <path d="M120 95 Q115 100 120 105 Q125 100 120 95" />
        <path d="M120 100 Q112 108 120 115 Q128 108 120 100" />
        <path d="M120 107 Q110 115 120 122 Q130 115 120 107" />
        <line x1="120" y1="93" x2="120" y2="128" strokeWidth="0.5" />
      </g>

      {/* Handle */}
      <path
        d="M150 110 L175 110 Q185 110 185 100 L185 95"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Handle grip */}
      <rect x="180" y="85" width="10" height="12" rx="3" stroke={BROWN} strokeWidth="1.2" fill="none" />

      {/* Almond shapes */}
      <g opacity="0.25">
        <path d="M82 155 Q90 148 98 155 Q90 162 82 155" stroke={BROWN} strokeWidth="0.8" fill="none" />
        <path d="M142 155 Q150 148 158 155 Q150 162 142 155" stroke={BROWN} strokeWidth="0.8" fill="none" />
      </g>

      {/* Horizontal depth lines */}
      <g opacity="0.1" stroke={BROWN} strokeWidth="0.5">
        <line x1="80" y1="170" x2="160" y2="170" />
        <line x1="85" y1="174" x2="155" y2="174" />
        <line x1="90" y1="178" x2="150" y2="178" />
      </g>
    </svg>
  );
}

function SumatraMandheling() {
  return (
    <svg viewBox="0 0 240 200" fill="none" aria-hidden="true" className="w-full h-full">
      {/* Forest silhouette */}
      <g opacity="0.1" stroke={BROWN} strokeWidth="1.2">
        <line x1="50" y1="170" x2="50" y2="100" />
        <line x1="60" y1="170" x2="60" y2="85" />
        <line x1="70" y1="170" x2="70" y2="95" />
        <line x1="80" y1="170" x2="80" y2="80" />
        <line x1="90" y1="170" x2="90" y2="90" />
        <line x1="150" y1="170" x2="150" y2="90" />
        <line x1="160" y1="170" x2="160" y2="80" />
        <line x1="170" y1="170" x2="170" y2="95" />
        <line x1="180" y1="170" x2="180" y2="85" />
        <line x1="190" y1="170" x2="190" y2="100" />
      </g>

      {/* Canopy suggestion */}
      <g opacity="0.06" fill={BROWN}>
        <circle cx="50" cy="98" r="8" />
        <circle cx="60" cy="83" r="9" />
        <circle cx="70" cy="93" r="7" />
        <circle cx="80" cy="78" r="10" />
        <circle cx="90" cy="88" r="8" />
        <circle cx="150" cy="88" r="8" />
        <circle cx="160" cy="78" r="10" />
        <circle cx="170" cy="93" r="7" />
        <circle cx="180" cy="83" r="9" />
        <circle cx="190" cy="98" r="8" />
      </g>

      {/* Cupping bowl */}
      <path
        d="M95 130 Q90 155 100 165 L140 165 Q150 155 145 130"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Bowl rim - flared */}
      <path
        d="M90 130 Q120 125 150 130"
        stroke={BROWN}
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M92 128 Q120 123 148 128"
        stroke={BROWN}
        strokeWidth="1"
        fill="none"
        opacity="0.4"
      />

      {/* Coffee surface */}
      <ellipse cx="120" cy="132" rx="24" ry="3" fill={BROWN} opacity="0.08" />

      {/* Heavy layered steam */}
      <path
        d="M108 125 Q102 110 108 95 Q112 85 106 75"
        stroke={BROWN}
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />
      <path
        d="M120 123 Q118 105 122 90 Q124 80 120 68"
        stroke={BROWN}
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
        strokeLinecap="round"
      />
      <path
        d="M132 125 Q138 110 132 95 Q128 85 134 75"
        stroke={BROWN}
        strokeWidth="1.2"
        fill="none"
        opacity="0.4"
        strokeLinecap="round"
      />

      {/* Cedar branch near steam */}
      <g transform="translate(155, 70)" opacity="0.25">
        <line x1="0" y1="10" x2="0" y2="-10" stroke={BROWN} strokeWidth="0.8" />
        <line x1="0" y1="-5" x2="6" y2="-10" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="0" x2="7" y2="-3" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="-5" x2="-6" y2="-10" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="0" x2="-7" y2="-3" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="5" x2="6" y2="2" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="5" x2="-6" y2="2" stroke={BROWN} strokeWidth="0.6" />
      </g>
      <g transform="translate(82, 65)" opacity="0.2">
        <line x1="0" y1="8" x2="0" y2="-8" stroke={BROWN} strokeWidth="0.8" />
        <line x1="0" y1="-4" x2="5" y2="-8" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="0" x2="5" y2="-2" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="-4" x2="-5" y2="-8" stroke={BROWN} strokeWidth="0.6" />
        <line x1="0" y1="0" x2="-5" y2="-2" stroke={BROWN} strokeWidth="0.6" />
      </g>

      {/* Root-like curves at base */}
      <g opacity="0.15" stroke={BROWN} strokeWidth="0.8" fill="none">
        <path d="M85 172 Q100 178 115 172 Q130 166 145 172 Q155 176 165 172" strokeLinecap="round" />
        <path d="M90 176 Q105 182 118 176 Q132 170 148 176" strokeLinecap="round" />
      </g>
    </svg>
  );
}

const illustrations: Record<number, () => React.JSX.Element> = {
  1: EthiopiaYirgacheffe,
  2: ColombiaSupremo,
  3: GuatemalaAntigua,
  4: KenyaAA,
  5: BrazilSantos,
  6: SumatraMandheling,
};

export default function CoffeeIllustration({
  productId,
  className,
}: {
  productId: number;
  className?: string;
}) {
  const Illustration = illustrations[productId];
  if (!Illustration) return null;

  return (
    <div className={className}>
      <Illustration />
    </div>
  );
}
