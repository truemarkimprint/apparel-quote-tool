import React, { useMemo, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Calculator, Shirt, RefreshCcw, Save, Package, FileText } from "lucide-react";
import { motion } from "framer-motion";

const garmentCatalog = {
  tees: [
    { id: "g500", label: "Budget Tee — Gildan G500 (Standard Cotton)", baseCost: 5.25, premium: false },
    { id: "pc54", label: "Value Tee — Port & Company PC54 (Softer Cotton)", baseCost: 5.95, premium: false },
    { id: "n3600", label: "Soft Tee — Next Level 3600 (Retail Fit)", baseCost: 7.75, premium: true },
    { id: "3001", label: "Premium Tee — Bella+Canvas 3001 (Best Seller)", baseCost: 8.5, premium: true },
    { id: "dm130", label: "Triblend Tee — District DM130 (Ultra Soft)", baseCost: 8.0, premium: true },
    { id: "c1717", label: "Heavyweight Tee — Comfort Colors 1717 (Garment Dyed)", baseCost: 9.5, premium: true },
  ],
  hoodies: [
    { id: "g185", label: "Budget Hoodie — Gildan G185", baseCost: 17.5, premium: false },
    { id: "pc78h", label: "Core Hoodie — Port & Company PC78H", baseCost: 19.25, premium: false },
    { id: "3719", label: "Premium Hoodie — Bella+Canvas 3719", baseCost: 28.75, premium: true },
  ],
  polos: [
    { id: "k100", label: "Core Polo — Port Authority K100", baseCost: 15.95, premium: false },
    { id: "st640", label: "Performance Polo — Sport-Tek ST640", baseCost: 18.85, premium: false },
    { id: "nkdc1963", label: "Premium Polo — Nike Dri-FIT Micro Pique", baseCost: 34.5, premium: true },
  ],
  hats: [
    { id: "cp80", label: "Budget Cap — Port & Company CP80", baseCost: 6.25, premium: false },
    { id: "112", label: "Premium Trucker — Richardson 112", baseCost: 8.9, premium: true },
    { id: "c112", label: "Premium Snapback — Yupoong Classics", baseCost: 9.6, premium: true },
  ],
};

const defaultTiers = [
  { minQty: 1, maxQty: 11, garmentCostAdj: 0 },
  { minQty: 12, maxQty: 23, garmentCostAdj: -0.15 },
  { minQty: 24, maxQty: 47, garmentCostAdj: -0.35 },
  { minQty: 48, maxQty: 99, garmentCostAdj: -0.65 },
  { minQty: 100, maxQty: 249, garmentCostAdj: -0.85 },
  { minQty: 250, maxQty: 9999, garmentCostAdj: -1.1 },
];

const cardStyle = {
  background: "white",
  borderRadius: 20,
  padding: 24,
  boxShadow: "0 8px 30px rgba(15,23,42,0.08)",
  border: "1px solid #e2e8f0",
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  fontSize: 14,
  boxSizing: "border-box",
};

const readOnlyStyle = {
  ...inputStyle,
  background: "#f1f5f9",
  color: "#0f172a",
  display: "flex",
  alignItems: "center",
  minHeight: 42,
};

const labelStyle = {
  display: "block",
  fontSize: 13,
  fontWeight: 600,
  color: "#334155",
  marginBottom: 8,
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "white",
  color: "#0f172a",
  cursor: "pointer",
  fontWeight: 600,
};

function currency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(num);
}

function safeNum(value) {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function slugify(value) {
  return (value || "quote")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getTierForQty(qty, tiers) {
  return tiers.find((tier) => qty >= safeNum(tier.minQty) && qty <= safeNum(tier.maxQty));
}

function SectionTitle({ icon: Icon, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
      <Icon size={20} />
      <h2 style={{ margin: 0, fontSize: 22 }}>{children}</h2>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, bold = false }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        fontSize: 14,
        borderTop: bold ? "1px solid #e2e8f0" : "none",
        marginTop: bold ? 8 : 0,
        fontWeight: bold ? 700 : 500,
      }}
    >
      <span style={{ color: bold ? "#0f172a" : "#475569" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export default function App() {
  const [quoteName, setQuoteName] = useState("Spring Promo DTF Quote");
  const [customerName, setCustomerName] = useState("");
  const [salesRep, setSalesRep] = useState("EJ");
  const [garmentType, setGarmentType] = useState("tees");
  const [selectedGarmentId, setSelectedGarmentId] = useState("3001");

  const [frontPrint, setFrontPrint] = useState("1");
  const [backPrint, setBackPrint] = useState("none");
  const [hasSleevePrint, setHasSleevePrint] = useState(false);

  const [frontPrintCost, setFrontPrintCost] = useState(2);
  const [backPrintCost, setBackPrintCost] = useState(4);
  const [frontBackComboCost, setFrontBackComboCost] = useState(6);
  const [sleevePrintCost, setSleevePrintCost] = useState(1.4);

  const [xsToXlQty, setXsToXlQty] = useState(34);
  const [qty2xl, setQty2xl] = useState(8);
  const [qty3xl, setQty3xl] = useState(4);
  const [qty4xl, setQty4xl] = useState(2);

  const [upcharge2xl, setUpcharge2xl] = useState(2.5);
  const [upcharge3xl, setUpcharge3xl] = useState(3.5);
  const [upcharge4xl, setUpcharge4xl] = useState(4.5);

  const [setupFee, setSetupFee] = useState(35);
  const [artFee, setArtFee] = useState(25);
  const [shippingFee, setShippingFee] = useState(18);
  const [rushFee, setRushFee] = useState(0);
  const [packagingFeePerUnit, setPackagingFeePerUnit] = useState(0);

  const [overheadPct, setOverheadPct] = useState(10);
  const [profitMarginPct, setProfitMarginPct] = useState(38);
  const [salesTaxPct, setSalesTaxPct] = useState(7);
  const [includeTax, setIncludeTax] = useState(true);
  const [manualPriceEach, setManualPriceEach] = useState("");

  const [tiers] = useState(defaultTiers);
  const [notes, setNotes] = useState(
    "Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown."
  );

  const garmentOptions = garmentCatalog[garmentType] || [];
  const selectedGarment = garmentOptions.find((g) => g.id === selectedGarmentId) || garmentOptions[0];

  const totalSizeQty = useMemo(() => {
    return safeNum(xsToXlQty) + safeNum(qty2xl) + safeNum(qty3xl) + safeNum(qty4xl);
  }, [xsToXlQty, qty2xl, qty3xl, qty4xl]);

  const effectiveQuantity = totalSizeQty;
  const selectedTier = useMemo(() => getTierForQty(effectiveQuantity, tiers), [effectiveQuantity, tiers]);

  const garmentCostEach = useMemo(() => {
    const base = safeNum(selectedGarment?.baseCost);
    const tierAdj = safeNum(selectedTier?.garmentCostAdj);
    return Math.max(0, round2(base + tierAdj));
  }, [selectedGarment, selectedTier]);

  const decorationCostEach = useMemo(() => {
    const hasFront = frontPrint !== "none";
    const hasBack = backPrint !== "none";

    let dtfCost = 0;

    if (hasFront && hasBack) {
      dtfCost = safeNum(frontBackComboCost);
    } else if (hasFront) {
      dtfCost = safeNum(frontPrintCost);
    } else if (hasBack) {
      dtfCost = safeNum(backPrintCost);
    }

    if (hasSleevePrint) {
      dtfCost += safeNum(sleevePrintCost);
    }

    return round2(dtfCost);
  }, [frontPrint, backPrint, hasSleevePrint, frontPrintCost, backPrintCost, frontBackComboCost, sleevePrintCost]);

  const sizeUpchargeTotal = useMemo(() => {
    return round2(
      safeNum(qty2xl) * safeNum(upcharge2xl) +
        safeNum(qty3xl) * safeNum(upcharge3xl) +
        safeNum(qty4xl) * safeNum(upcharge4xl)
    );
  }, [qty2xl, qty3xl, qty4xl, upcharge2xl, upcharge3xl, upcharge4xl]);

  const calculations = useMemo(() => {
    const qty = effectiveQuantity;
    const garmentSubtotal = garmentCostEach * qty;
    const decorationSubtotal = decorationCostEach * qty;
    const packagingSubtotal = safeNum(packagingFeePerUnit) * qty;
    const fixedFees = safeNum(setupFee) + safeNum(artFee) + safeNum(shippingFee) + safeNum(rushFee);
    const hardCost = garmentSubtotal + decorationSubtotal + packagingSubtotal + fixedFees + sizeUpchargeTotal;
    const overhead = hardCost * (safeNum(overheadPct) / 100);
    const preProfit = hardCost + overhead;
    const profit = preProfit * (safeNum(profitMarginPct) / 100);
    const subtotal = preProfit + profit;
    const tax = includeTax ? subtotal * (safeNum(salesTaxPct) / 100) : 0;
    const finalTotal = subtotal + tax;

    const rawPrice = qty > 0 ? finalTotal / qty : 0;
    const calculatedPricePerPiece = Math.round(rawPrice * 4) / 4;

    const isManual = manualPriceEach !== "";
    const pricePerPiece = isManual ? safeNum(manualPriceEach) : calculatedPricePerPiece;

    const displaySubtotal = isManual ? pricePerPiece * qty : subtotal;

    const displayTotal = isManual
      ? includeTax
        ? displaySubtotal * (1 + safeNum(salesTaxPct) / 100)
        : displaySubtotal
      : finalTotal;

    return {
      garmentSubtotal,
      decorationSubtotal,
      packagingSubtotal,
      fixedFees,
      hardCost,
      overhead,
      profit,
      subtotal,
      tax,
      finalTotal,
      displaySubtotal,
      calculatedPricePerPiece,
      pricePerPiece,
      displayTotal,
    };
  }, [
    effectiveQuantity,
    garmentCostEach,
    decorationCostEach,
    packagingFeePerUnit,
    setupFee,
    artFee,
    shippingFee,
    rushFee,
    sizeUpchargeTotal,
    overheadPct,
    profitMarginPct,
    includeTax,
    salesTaxPct,
    manualPriceEach,
  ]);

  const garmentTypeLabel = {
    tees: "Tee",
    hoodies: "Hoodie",
    polos: "Polo",
    hats: "Hat",
  }[garmentType];

  const resetDefaults = () => {
    setQuoteName("Spring Promo DTF Quote");
    setCustomerName("");
    setSalesRep("EJ");
    setGarmentType("tees");
    setSelectedGarmentId("3001");
    setFrontPrint("1");
    setBackPrint("none");
    setHasSleevePrint(false);
    setFrontPrintCost(2);
    setBackPrintCost(4);
    setFrontBackComboCost(6);
    setSleevePrintCost(1.4);
    setXsToXlQty(34);
    setQty2xl(8);
    setQty3xl(4);
    setQty4xl(2);
    setUpcharge2xl(2.5);
    setUpcharge3xl(3.5);
    setUpcharge4xl(4.5);
    setSetupFee(35);
    setArtFee(25);
    setShippingFee(18);
    setRushFee(0);
    setPackagingFeePerUnit(0);
    setOverheadPct(10);
    setProfitMarginPct(38);
    setSalesTaxPct(7);
    setIncludeTax(true);
    setManualPriceEach("");
    setNotes(
      "Quote includes standard DTF production. Freight beyond local delivery not included unless listed above. Final invoice may adjust for exact garment availability and size breakdown."
    );
  };

  const generateQuotePdf = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    const isManual = manualPriceEach !== "";
    const pdfSubtotal = isManual ? calculations.displaySubtotal : calculations.subtotal;
    const pdfTax = isManual ? calculations.displayTotal - calculations.displaySubtotal : calculations.tax;
    const pdfTotal = isManual ? calculations.displayTotal : calculations.finalTotal;

    doc.setFontSize(20);
    doc.text("TrueMark Imprint Co. — Quote", 14, 18);
    doc.setFontSize(10);
    doc.text("Custom Apparel Pricing", 14, 22);

    doc.setFontSize(10);
    doc.text(`Prepared for: ${customerName || "Client"}`, 14, 28);
    doc.text(`Quote name: ${quoteName}`, 14, 34);
    doc.text(`Sales rep: ${salesRep}`, 14, 40);
    doc.text(`Decoration: DTF`, 14, 46);
    doc.text(`Garment: ${selectedGarment?.label || ""}`, 14, 52);
    doc.text(`Quantity: ${effectiveQuantity}`, 14, 58);
    doc.text(
  `Generated: ${new Date().toLocaleDateString()}`,
  pageWidth - 14,
  28,
  { align: "right" }
);


    autoTable(doc, {
      startY: 66,
      theme: "grid",
      head: [["Category", "Details", "Amount"]],
      body: isManual
  ? [
      ["Garment", `${garmentTypeLabel} • ${selectedGarment?.label || ""}`, ""],
      [
        "DTF Print",
        `Front: ${frontPrint === "full" ? "Full Color" : frontPrint === "1" ? "1 Color" : "None"} | Back: ${
          backPrint === "none" ? "None" : backPrint === "full" ? "Full Color" : "1 Color"
        }${hasSleevePrint ? " | Sleeve Print" : ""}`,
        "",
      ],
      [
        "Size breakdown",
        `XS-XL: ${xsToXlQty} | 2XL: ${qty2xl} | 3XL: ${qty3xl} | 4XL: ${qty4xl}`,
        "",
      ],
      [
        "Custom quoted pricing applied",
        `${effectiveQuantity} × ${currency(manualPriceEach)}`,
        currency(pdfSubtotal),
      ],
      ["Subtotal", "", currency(pdfSubtotal)],
      ["Tax", includeTax ? `${salesTaxPct}% applied` : "Not included", currency(pdfTax)],
      ["Final total", "", currency(pdfTotal)],
    ]
  : [
      ["Garment", `${garmentTypeLabel} • ${selectedGarment?.label || ""}`, currency(calculations.garmentSubtotal)],
      [
        "DTF Print",
        `Front: ${frontPrint === "full" ? "Full Color" : frontPrint === "1" ? "1 Color" : "None"} | Back: ${
          backPrint === "none" ? "None" : backPrint === "full" ? "Full Color" : "1 Color"
        }${hasSleevePrint ? " | Sleeve Print" : ""}`,
        currency(calculations.decorationSubtotal),
      ],
      [
        "Size breakdown",
        `XS-XL: ${xsToXlQty} | 2XL: ${qty2xl} | 3XL: ${qty3xl} | 4XL: ${qty4xl}`,
        currency(sizeUpchargeTotal),
      ],
      ["Packaging", `${currency(packagingFeePerUnit)} per unit`, currency(calculations.packagingSubtotal)],
      ["Fixed fees", "Setup, art, shipping, rush", currency(calculations.fixedFees)],
      ["Subtotal", "", currency(calculations.subtotal)],
      ["Tax", includeTax ? `${salesTaxPct}% applied` : "Not included", currency(calculations.tax)],
      ["Final total", "", currency(calculations.finalTotal)],
    ],
      headStyles: { fillColor: [15, 23, 42] },
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 85 },
        2: { halign: "right", cellWidth: 45 },
      },
    });

    const tableEndY = doc.lastAutoTable?.finalY || 140;
    doc.setFontSize(11);
    doc.text("Notes", 14, tableEndY + 14);
    doc.setFontSize(10);
    const wrappedNotes = doc.splitTextToSize(notes || "", 180);
    doc.text(wrappedNotes, 14, tableEndY + 22);

    doc.setFontSize(9);
    doc.text("Thank you for the opportunity to quote your apparel project.", 14, 280);

    doc.save(`${slugify(quoteName)}.pdf`);
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: 24,
        fontFamily: "Inter, Arial, sans-serif",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 16,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <div>
              <h1
  style={{
    display: "flex",
    alignItems: "center",
    gap: 12,
    margin: 0,
    fontSize: 34,
    color: "#0f172a",
  }}
>
                <Shirt size={32} color="#0f172a" /> TrueMark Quote Tool
              </h1>
              <p style={{ color: "#475569", marginTop: 8 }}>
                Fast DTF apparel pricing with branded garment presets, size-specific upcharges, and customer-facing quote output.
              </p>
            </div>
            <div style={{ display: "flex", gap: 12 }}>
              <button style={buttonStyle} onClick={resetDefaults}>
                <RefreshCcw size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Reset
              </button>
              <button style={buttonStyle}>
                <Save size={16} style={{ marginRight: 8, verticalAlign: "middle" }} /> Save Quote
              </button>
            </div>
          </div>
        </motion.div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 24 }}>
          <div style={{ display: "grid", gap: 24 }}>
            <div style={cardStyle}>
              <SectionTitle icon={Calculator}>Quote Builder</SectionTitle>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Quote Name">
                  <input style={inputStyle} value={quoteName} onChange={(e) => setQuoteName(e.target.value)} />
                </Field>
                <Field label="Customer">
                  <input
                    style={inputStyle}
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Client / organization"
                  />
                </Field>
                <Field label="Sales Rep">
                  <input style={inputStyle} value={salesRep} onChange={(e) => setSalesRep(e.target.value)} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Garment Category">
                  <select
                    style={inputStyle}
                    value={garmentType}
                    onChange={(e) => {
                      const value = e.target.value;
                      setGarmentType(value);
                      setSelectedGarmentId(garmentCatalog[value][0].id);
                    }}
                  >
                    <option value="tees">Tees</option>
                    <option value="hoodies">Hoodies</option>
                    <option value="polos">Polos</option>
                    <option value="hats">Hats</option>
                  </select>
                </Field>
                <Field label="Garment Style">
                  <select style={inputStyle} value={selectedGarmentId} onChange={(e) => setSelectedGarmentId(e.target.value)}>
                    {garmentOptions.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Total Quantity">
                  <div style={readOnlyStyle}>{effectiveQuantity}</div>
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Front Print">
                  <select style={inputStyle} value={frontPrint} onChange={(e) => setFrontPrint(e.target.value)}>
                    <option value="none">None</option>
                    <option value="1">1 Color</option>
                    <option value="full">Full Color</option>
                  </select>
                </Field>
                <Field label="Back Print">
                  <select style={inputStyle} value={backPrint} onChange={(e) => setBackPrint(e.target.value)}>
                    <option value="none">None</option>
                    <option value="1">1 Color</option>
                    <option value="full">Full Color</option>
                  </select>
                </Field>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600 }}>
                    <input type="checkbox" checked={hasSleevePrint} onChange={(e) => setHasSleevePrint(e.target.checked)} />
                    Sleeve Print
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Front Print Cost">
                  <input style={inputStyle} type="number" value={frontPrintCost} onChange={(e) => setFrontPrintCost(e.target.value)} />
                </Field>
                <Field label="Back Print Cost">
                  <input style={inputStyle} type="number" value={backPrintCost} onChange={(e) => setBackPrintCost(e.target.value)} />
                </Field>
                <Field label="Front + Back Combo">
                  <input
                    style={inputStyle}
                    type="number"
                    value={frontBackComboCost}
                    onChange={(e) => setFrontBackComboCost(e.target.value)}
                  />
                </Field>
                <Field label="Sleeve Print Cost">
                  <input style={inputStyle} type="number" value={sleevePrintCost} onChange={(e) => setSleevePrintCost(e.target.value)} />
                </Field>
              </div>

              <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Size Breakdown</div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="XS–XL Qty">
                  <input style={inputStyle} type="number" value={xsToXlQty} onChange={(e) => setXsToXlQty(e.target.value)} />
                </Field>
                <Field label="2XL Qty">
                  <input style={inputStyle} type="number" value={qty2xl} onChange={(e) => setQty2xl(e.target.value)} />
                </Field>
                <Field label="3XL Qty">
                  <input style={inputStyle} type="number" value={qty3xl} onChange={(e) => setQty3xl(e.target.value)} />
                </Field>
                <Field label="4XL Qty">
                  <input style={inputStyle} type="number" value={qty4xl} onChange={(e) => setQty4xl(e.target.value)} />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="2XL Upcharge">
                  <input style={inputStyle} type="number" value={upcharge2xl} onChange={(e) => setUpcharge2xl(e.target.value)} />
                </Field>
                <Field label="3XL Upcharge">
                  <input style={inputStyle} type="number" value={upcharge3xl} onChange={(e) => setUpcharge3xl(e.target.value)} />
                </Field>
                <Field label="4XL Upcharge">
                  <input style={inputStyle} type="number" value={upcharge4xl} onChange={(e) => setUpcharge4xl(e.target.value)} />
                </Field>
              </div>

              <div style={{ marginBottom: 16, color: "#475569", fontSize: 13 }}>
                Size total entered: <strong>{totalSizeQty}</strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Setup Fee">
                  <input style={inputStyle} type="number" value={setupFee} onChange={(e) => setSetupFee(e.target.value)} />
                </Field>
                <Field label="Art Fee">
                  <input style={inputStyle} type="number" value={artFee} onChange={(e) => setArtFee(e.target.value)} />
                </Field>
                <Field label="Shipping Fee">
                  <input style={inputStyle} type="number" value={shippingFee} onChange={(e) => setShippingFee(e.target.value)} />
                </Field>
                <Field label="Rush Fee">
                  <input style={inputStyle} type="number" value={rushFee} onChange={(e) => setRushFee(e.target.value)} />
                </Field>
                <Field label="Packaging / Unit">
                  <input
                    style={inputStyle}
                    type="number"
                    value={packagingFeePerUnit}
                    onChange={(e) => setPackagingFeePerUnit(e.target.value)}
                  />
                </Field>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
                <Field label="Overhead %">
                  <input style={inputStyle} type="number" value={overheadPct} onChange={(e) => setOverheadPct(e.target.value)} />
                </Field>
                <Field label="Profit Margin %">
                  <input style={inputStyle} type="number" value={profitMarginPct} onChange={(e) => setProfitMarginPct(e.target.value)} />
                </Field>
                <Field label="Sales Tax %">
                  <input style={inputStyle} type="number" value={salesTaxPct} onChange={(e) => setSalesTaxPct(e.target.value)} />
                </Field>
                <Field label="Manual Price / Piece">
                  <input
                    style={inputStyle}
                    type="number"
                    step="0.01"
                    placeholder="Optional"
                    value={manualPriceEach}
                    onChange={(e) => setManualPriceEach(e.target.value)}
                  />
                </Field>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 14, fontWeight: 600 }}>
                  <input type="checkbox" checked={includeTax} onChange={(e) => setIncludeTax(e.target.checked)} />
                  Include tax in final quote
                </label>
              </div>

              <Field label="Quote Notes">
                <textarea
                  style={{ ...inputStyle, minHeight: 110, resize: "vertical" }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Field>
            </div>
          </div>

          <div style={{ display: "grid", gap: 24, alignSelf: "start" }}>
            <div style={cardStyle}>
              <SectionTitle icon={Package}>Internal Pricing Summary</SectionTitle>
              <div style={{ background: "#0f172a", color: "white", borderRadius: 20, padding: 20, marginBottom: 18 }}>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>Sell Price / Piece</div>
                <div style={{ fontSize: 38, fontWeight: 800, marginTop: 8 }}>{currency(calculations.pricePerPiece)}</div>
                <div style={{ color: "#cbd5e1", fontSize: 14, marginTop: 8 }}>Total Quote: {currency(calculations.displayTotal)}</div>
              </div>

              <SummaryRow label="Quoted quantity" value={String(effectiveQuantity)} />
              <SummaryRow label="Garment / ea" value={currency(garmentCostEach)} />
              <SummaryRow label="DTF / ea" value={currency(decorationCostEach)} />
              <SummaryRow label="Garment subtotal" value={currency(calculations.garmentSubtotal)} />
              <SummaryRow label="DTF subtotal" value={currency(calculations.decorationSubtotal)} />
              <SummaryRow label="Size upcharges" value={currency(sizeUpchargeTotal)} />
              <SummaryRow label="Packaging subtotal" value={currency(calculations.packagingSubtotal)} />
              <SummaryRow label="Fixed fees" value={currency(calculations.fixedFees)} />
              <SummaryRow label="Overhead" value={currency(calculations.overhead)} />
              <SummaryRow label="Profit" value={currency(calculations.profit)} />

              {manualPriceEach !== "" && (
                <SummaryRow label="Manual pricing active" value={`${effectiveQuantity} × ${currency(manualPriceEach)}`} />
              )}

              <SummaryRow
                label={manualPriceEach !== "" ? "Manual subtotal" : "Subtotal"}
                value={currency(manualPriceEach !== "" ? calculations.displaySubtotal : calculations.subtotal)}
                bold
              />
              <SummaryRow
                label="Tax"
                value={currency(
                  manualPriceEach !== "" ? calculations.displayTotal - calculations.displaySubtotal : calculations.tax
                )}
              />
            </div>

            <div style={{ ...cardStyle, border: "2px solid #0f172a" }}>
              <SectionTitle icon={FileText}>Customer Quote Preview</SectionTitle>
              <div style={{ marginBottom: 14 }}>
                <div style={{ textTransform: "uppercase", letterSpacing: 1, fontSize: 12, color: "#64748b" }}>Quote</div>
                <h3 style={{ margin: "6px 0 0", fontSize: 28 }}>{quoteName}</h3>
                <div style={{ marginTop: 6, color: "#475569", fontSize: 14 }}>
                  Prepared for {customerName || "Client"} • Rep: {salesRep}
                </div>
              </div>

              <div style={{ background: "#f8fafc", borderRadius: 16, padding: 16, fontSize: 14, marginBottom: 16 }}>
                <SummaryRow label="Garment" value={selectedGarment?.label || ""} />
                <SummaryRow label="Category" value={garmentTypeLabel} />
                <SummaryRow label="Decoration" value="DTF" />
                <SummaryRow label="Quantity" value={String(effectiveQuantity)} />
                <SummaryRow
                  label="Print Details"
                  value={`Front: ${frontPrint === "full" ? "Full Color" : frontPrint === "1" ? "1 Color" : "None"} | Back: ${
                    backPrint === "none" ? "None" : backPrint === "full" ? "Full Color" : "1 Color"
                  }${hasSleevePrint ? " | Sleeve" : ""}`}
                />
                <SummaryRow label="Sizes" value={`XS-XL: ${xsToXlQty} | 2XL: ${qty2xl} | 3XL: ${qty3xl} | 4XL: ${qty4xl}`} />
              </div>

              <div style={{ background: "#0f172a", color: "white", borderRadius: 20, padding: 20, marginBottom: 16 }}>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>Quoted Price</div>
                <div style={{ fontSize: 40, fontWeight: 800, marginTop: 8 }}>{currency(calculations.pricePerPiece)}</div>
                <div style={{ color: "#cbd5e1", fontSize: 14 }}>per piece</div>
                <div
                  style={{
                    borderTop: "1px solid #334155",
                    marginTop: 16,
                    paddingTop: 16,
                    fontSize: 14,
                    display: "flex",
                    justifyContent: "space-between",
                  }}
                >
                  <span>Total Project</span>
                  <strong>{currency(calculations.displayTotal)}</strong>
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 8 }}>Notes</div>
                <div style={{ color: "#475569", fontSize: 14, lineHeight: 1.6 }}>{notes}</div>
              </div>

              <button
                onClick={generateQuotePdf}
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  borderRadius: 14,
                  border: "none",
                  background: "#0f172a",
                  color: "white",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Generate Customer Quote PDF
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}