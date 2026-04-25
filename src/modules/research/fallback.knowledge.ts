// =============================================================================
// Fallback Knowledge Base — Vehicle Research Module
// Used when the AI provider is unavailable or times out.
// Returns structured research data based on make/model/year.
// =============================================================================

import type { VehicleResearchResult, ResearchSection, ResearchIssue } from '@/types'

function item(title: string, description: string, severity: 'high' | 'medium' | 'low', tags: ResearchIssue['tags']): ResearchIssue {
  return { title, description, severity, tags }
}

function section(id: string, title: string, items: ResearchIssue[]): ResearchSection {
  return { id, title, items }
}

function normalizeLocale(locale?: string): string {
  return (locale ?? 'en').toLowerCase().split('-')[0]
}

// ─── Brand-specific knowledge ─────────────────────────────────────────────────

const BMW_KNOWLEDGE = {
  commonProblems: section('commonProblems', 'Common Problems', [
    item('Cooling System Failures', 'Water pump and thermostat are known weak points, especially plastic housings on 6-cylinder engines. Failure can lead to overheating rapidly.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Oil Leaks', 'Valve cover gaskets, oil filter housing gaskets, and rear crankshaft seals commonly leak on high-mileage examples. Look for oil residue around the engine block.', 'medium', ['COMMON_ISSUE']),
    item('Electronics & Comfort Features', 'Window regulators, iDrive glitches, and comfort module failures are frequently reported. These are minor but expensive to diagnose and repair at a dealership.', 'medium', ['COMMON_ISSUE']),
    item('N47 Timing Chain (4-cyl diesel)', 'Applies to 318d, 320d, 520d. The timing chain can rattle and fail catastrophically, check for cold-start rattle. Not applicable to N57 (530d) or N55/N52 petrol.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('High-Pressure Fuel Pump (diesel)', 'HPFP failure causes hard starting, misfires, and white smoke. Common on high-mileage diesel examples. Listen for rough idle and hesitation under load.', 'medium', ['COMMON_ISSUE']),
  ]),
  highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
    item('Cold Start, Engine Sound', 'Idle the car for 2+ minutes when cold. A rattling or ticking sound at startup can indicate timing chain wear or VANOS actuator issues.', 'high', ['HIGH_ATTENTION']),
    item('Coolant Level & Condition', 'Check the expansion tank. BMW coolant should be blue/green and full. Brown or murky coolant signals internal corrosion or head gasket issues.', 'high', ['HIGH_ATTENTION']),
    item('Oil Level & Quality', 'Check the oil. Excessive oil consumption (>1L per 1000km) is reported on some N-series engines. Look for mayonnaise under the cap (coolant contamination).', 'high', ['HIGH_ATTENTION']),
    item('Service History Completeness', 'BMW maintenance is expensive. A missing service record (especially timing chain service or DSC/brake fluid service) is a major red flag.', 'high', ['HIGH_ATTENTION']),
  ]),
  visualAttention: section('visualAttention', 'Visual Attention Areas', [
    item('Rear Subframe for Rust', 'F10/E60/E90-era BMWs can develop rust around the rear subframe mounting points. Inspect underneath if possible.', 'high', ['VISUAL_CHECK']),
    item('Sunroof Drains', 'Blocked sunroof drains cause water to pool in the footwells and damage electronics. Check for damp carpets.', 'medium', ['VISUAL_CHECK']),
    item('Panel Gaps & Paint Uniformity', 'Check all body panels for inconsistent gaps or colour variations, indicators of previous accident repair.', 'medium', ['VISUAL_CHECK']),
    item('Tyre Wear Pattern', 'Uneven tyre wear points to suspension, alignment, or camber issues. BMW sport suspension components are expensive to replace.', 'medium', ['VISUAL_CHECK']),
  ]),
  mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
    item('VANOS System', 'The variable valve timing system can fail causing rough idle and poor performance. Listen for rattling at idle or irregular engine note.', 'medium', ['COMMON_ISSUE']),
    item('Automatic Transmission (ZF 8HP)', 'The ZF 8-speed is generally reliable but needs regular fluid changes. Ask for transmission service history. Hesitation or harsh shifts suggest low fluid or worn clutch packs.', 'medium', ['COMMON_ISSUE']),
    item('Rear Integral Link Bushings', 'F10 5-series has hydraulic rear bushings that deteriorate. Worn bushings cause rear-end instability and tyre wear. Listen for clunks over bumps.', 'medium', ['COMMON_ISSUE']),
    item('Brakes, Size & Cost', 'BMW brakes are larger than average. Rear callipers seize if the parking brake is rarely used. Budget for brake pad/disc replacement ($600–$1200 at an independent).', 'low', ['EXPENSIVE_RISK']),
  ]),
  testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
    item('Transmission Smoothness', 'Automatic should shift seamlessly in all modes. Any shudder, hunting between gears, or hard downshift requires immediate investigation.', 'high', ['TEST_DRIVE']),
    item('Steering Feedback & Straight-Line Tracking', 'BMW should feel connected and track straight. Pulling to one side suggests suspension, alignment, or brake drag issues.', 'medium', ['TEST_DRIVE']),
    item('Brake Pedal Feel', 'The pedal should be firm mid-travel. Sponginess or pulsation suggests warped discs or air in the brake system.', 'high', ['TEST_DRIVE']),
    item('Engine Under Load', 'Accelerate firmly through the rev range. Any hesitation, smoke, or unusual noise under load can indicate turbo, injector, or fuel system issues.', 'high', ['TEST_DRIVE']),
  ]),
  costAwareness: section('costAwareness', 'Cost Awareness', [
    item('Timing Chain Repair (4-cyl diesel)', 'N47 timing chain replacement: £2,000–£5,000 at an independent. If the chain has failed, the engine may be beyond economic repair.', 'high', ['EXPENSIVE_RISK']),
    item('Cooling System Overhaul', 'Full cooling system replacement (pump, thermostat, hoses, expansion tank): £700–£1,500. Do not skip this on high-mileage examples.', 'high', ['EXPENSIVE_RISK']),
    item('Suspension Refresh', 'Rear integral links, front control arms, and thrust arms: £800–£2,000 for full refresh at a specialist. Inspect carefully for worn rubber.', 'medium', ['EXPENSIVE_RISK']),
    item('Software & Electronics Diagnostics', 'BMW ISTA/INPA dealer-level diagnostics reveal stored fault codes invisible to generic OBD tools. Pay £50–£100 for a pre-purchase scan.', 'medium', ['HIGH_ATTENTION']),
  ]),
}

const MERCEDES_KNOWLEDGE = {
  commonProblems: section('commonProblems', 'Common Problems', [
    item('7G-Tronic Transmission', 'The 7-speed automatic has weak torque converter and valve body. Jerky low-speed shifts and slip under load are warning signs. Full rebuild: £2,000–£4,000.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Rust Under Window and Door Seals', 'W204 C-Class and W212 E-Class can develop hidden rust behind rubber seals. Peel back the seal at the bottom of windows to check.', 'high', ['COMMON_ISSUE']),
    item('Fuel Injector Leaks (diesel)', 'CDI diesel injectors can leak or fail. White smoke at startup and poor cold-start performance are key symptoms.', 'medium', ['COMMON_ISSUE']),
    item('Air Suspension (Airmatic)', 'On equipped models, compressor and air struts fail. Look for sagging at the rear. Replacement cost: £1,500–£3,000+.', 'high', ['EXPENSIVE_RISK']),
  ]),
  highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
    item('STAR Diagnostics Scan', 'Mercedes-specific faults are invisible to generic OBD readers. A full STAR or iCarsoft MB II scan before purchase is essential.', 'high', ['HIGH_ATTENTION']),
    item('Transmission Fluid Condition', 'Check for dark or burnt-smelling ATF. Mercedes "sealed for life" transmissions need fluid changes every 60–80k miles in practice.', 'high', ['HIGH_ATTENTION']),
    item('Rust Inspection Under Seals', 'Use a torch to inspect beneath door and window rubbers, especially on the sills. Hidden rust here is structural.', 'high', ['HIGH_ATTENTION']),
  ]),
  visualAttention: section('visualAttention', 'Visual Attention Areas', [
    item('Sill & Wheel Arch Rust', 'Check sills at the front and rear junction points, and inner wheel arches for bubbling paint or rust perforation.', 'high', ['VISUAL_CHECK']),
    item('Engine Bay Oil Residue', 'CDI engines can develop oil leaks from the cam cover and turbo connections. Whitish residue or dark oil staining indicates active leaks.', 'medium', ['VISUAL_CHECK']),
    item('Interior Trim Condition', 'W204/W212 plastics crack and warp. This is cosmetic but expensive to replace with genuine parts. Check the instrument surround and centre console.', 'low', ['VISUAL_CHECK']),
  ]),
  mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
    item('Balance Shaft (M271 petrol)', 'The M271 balance shaft can fail. Rattling on startup indicates balance shaft or oil pump chain wear. This is a major repair.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('EGR System (diesel)', 'EGR valves coke up on diesel models used mainly for short trips. Causes hesitation and limp mode. Cleaning: £200–£500. Replacement: more.', 'medium', ['COMMON_ISSUE']),
  ]),
  testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
    item('Transmission at Low Speed', 'Drive slowly in a car park. The 7G-Tronic should engage smoothly from rest. Any shuddering or clunking is a serious red flag.', 'high', ['TEST_DRIVE']),
    item('Air Suspension Level (if equipped)', 'Park on level ground after the drive. Check that all four corners sit at the same height. A drooping corner indicates a failed strut or compressor.', 'high', ['TEST_DRIVE']),
  ]),
  costAwareness: section('costAwareness', 'Cost Awareness', [
    item('Transmission Rebuild', 'W7 7G-Tronic rebuild or remanufactured unit: £2,000–£4,500 fitted. Non-negotiable if symptoms are present.', 'high', ['EXPENSIVE_RISK']),
    item('Air Suspension Overhaul', 'Full Airmatic system overhaul: £2,000–£5,000 depending on which corners are affected. Independent specialist is 40–60% cheaper than dealer.', 'high', ['EXPENSIVE_RISK']),
  ]),
}

const AUDI_VW_KNOWLEDGE = {
  commonProblems: section('commonProblems', 'Common Problems', [
    item('DSG/S Tronic Dual-Clutch Gearbox', 'The DQ200 7-speed dry-clutch DSG is known for shuddering at low speed and mechatronic unit failure. Replacement mechatronic: £800–£2,000. The DQ250 wet-clutch is more reliable.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Timing Belt/Chain Failure', '2.0 TFSI petrol engines (EA888 Gen1-2) had camshaft follower and timing chain tensioner issues. Early EA113 had timing belt issues. Know your engine generation.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Carbon Buildup on Intake Valves (TFSI)', 'Direct injection engines accumulate carbon on intake valves, causing rough idle and misfires. Walnut shell cleaning: £300–£600.', 'medium', ['COMMON_ISSUE']),
    item('MMI/Electronics Failures', 'MMI infotainment units fail (black screen, no sound). Fan control units on Audi also commonly fail causing overheating.', 'medium', ['COMMON_ISSUE']),
  ]),
  highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
    item('Timing Belt/Chain Service Date', 'For timing belt engines, confirm exact date and mileage of last replacement. This is a critical safety item, do not guess.', 'high', ['HIGH_ATTENTION']),
    item('DSG Shudder Test', 'At low speed (5–15 mph) in a car park, maintain light throttle. Any judder, vibration, or hesitation indicates DSG clutch pack or mechatronic wear.', 'high', ['HIGH_ATTENTION']),
    item('VCDS Fault Code Scan', 'Audi/VW-specific diagnostics reveal faults invisible to generic tools. VCDS or ODIS scan should be performed before purchase.', 'high', ['HIGH_ATTENTION']),
  ]),
  visualAttention: section('visualAttention', 'Visual Attention Areas', [
    item('Oil Filler Cap, Mayonnaise', 'Remove the oil filler cap and check for creamy residue. This indicates coolant contamination and potential head gasket failure (common on 2.0 TFSI).', 'high', ['VISUAL_CHECK']),
    item('Rear Torsion Beam Rust (VW)', 'On Golf/Jetta/Passat, inspect the rear torsion beam for rust. Surface rust is normal; penetrating rust is structural.', 'medium', ['VISUAL_CHECK']),
    item('Sunroof Seal & Water Ingress', 'Check the A-pillar trim and footwell carpets for water staining. Blocked sunroof drains flood the cabin and damage ECUs.', 'medium', ['VISUAL_CHECK']),
  ]),
  mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
    item('Haldex Coupling (quattro/4Motion)', 'Four-wheel drive Haldex units need fluid changes every 20k miles. Neglect causes diff binding and clutch failure. Ask for service history.', 'medium', ['COMMON_ISSUE']),
    item('Water Pump (EA888)', 'The 2.0 TFSI water pump is plastic and frequently fails. A replacement is reasonable (£300–£600 at an independent) but needs to be done proactively.', 'medium', ['COMMON_ISSUE']),
  ]),
  testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
    item('DSG Engagement from Stop', 'From a standstill, ease onto the throttle without lifting. A good DSG engages cleanly. Judder at 5–20 mph is the key failure symptom.', 'high', ['TEST_DRIVE']),
    item('TFSI Idle Quality', 'A healthy EA888 should idle smoothly and quietly. Carbon buildup or misfires cause a lumpy idle that is immediately noticeable.', 'medium', ['TEST_DRIVE']),
  ]),
  costAwareness: section('costAwareness', 'Cost Awareness', [
    item('DSG Mechatronic Unit', 'DQ200 mechatronic replacement: £800–£2,000 at a specialist. If the gearbox shudders, factor this into the negotiation.', 'high', ['EXPENSIVE_RISK']),
    item('Timing Chain Kit (EA888)', 'Full timing chain kit (chain, tensioners, guides): £600–£1,200 at an independent. Non-negotiable on pre-2012 EA888 engines.', 'high', ['EXPENSIVE_RISK']),
  ]),
}

const TOYOTA_KNOWLEDGE = {
  commonProblems: section('commonProblems', 'Common Problems', [
    item('D-4D Injector Failure (diesel)', '2.0 D-4D diesel injectors can crack, causing rough running and white smoke. Replacement cost per injector: £200–£600. All four often need replacing together.', 'medium', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Rust on High-Mileage Examples', 'Older Toyotas can rust around the rear wheel arches and sills despite their general reliability. Check structural areas carefully.', 'medium', ['COMMON_ISSUE']),
    item('Suspension Wear (Strut Mounts)', 'Front strut mounts and lower ball joints wear out at high mileage. Clunking over bumps is the key symptom.', 'low', ['COMMON_ISSUE']),
  ]),
  highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
    item('Diesel Injector Compression Test', 'If diesel, request a compression test or have injectors tested before purchase. Cracked injectors are a significant cost.', 'high', ['HIGH_ATTENTION']),
    item('Service Record Verification', 'Toyota reliability is largely dependent on proper maintenance. Incomplete oil change records are a concern on high-mileage examples.', 'medium', ['HIGH_ATTENTION']),
  ]),
  visualAttention: section('visualAttention', 'Visual Attention Areas', [
    item('Rear Wheel Arch Rust', 'Inspect the trailing edge of rear wheel arches and the bottom of the rear doors for rust bubbling or perforation.', 'medium', ['VISUAL_CHECK']),
    item('Engine Bay Cleanliness', 'Toyotas rarely have oil leaks unless neglected. An unusually dirty engine bay may indicate a cover-up for leaks.', 'low', ['VISUAL_CHECK']),
  ]),
  mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
    item('CVT Transmission (if equipped)', 'CVT units can whine under heavy load and fail at very high mileage. Any burning smell or slipping sensation is a red flag.', 'medium', ['COMMON_ISSUE']),
    item('Hybrid Battery Health (Prius/Auris)', 'For hybrid models, check battery health with Toyota Techstream or a specialist tool. Weak cells significantly reduce performance.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
  ]),
  testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
    item('Diesel Smoke at Startup', 'Minimal white smoke at cold startup is normal. Sustained smoke once warm indicates injector or turbo issues.', 'medium', ['TEST_DRIVE']),
    item('Overall Drivetrain Refinement', 'Toyotas should feel smooth and refined. Any harshness, vibration or unusual noise is more concerning than on comparable European models given their reputation.', 'low', ['TEST_DRIVE']),
  ]),
  costAwareness: section('costAwareness', 'Cost Awareness', [
    item('D-4D Injector Set', 'Full set of 4 injectors: £800–£2,400 depending on reman vs. new. Testing before purchase can identify which (if any) are faulty.', 'high', ['EXPENSIVE_RISK']),
    item('Hybrid Battery (if applicable)', 'OEM hybrid battery replacement: £1,500–£3,000. Third-party remanufactured packs: £800–£1,500. Confirm warranty.', 'high', ['EXPENSIVE_RISK']),
  ]),
}

const FORD_KNOWLEDGE = {
  commonProblems: section('commonProblems', 'Common Problems', [
    item('EcoBoost Turbo & Coolant Issues', '1.0 EcoBoost can overheat if coolant level drops. Coolant mixing with oil is reported. Check for head gasket issues, common on early EcoBoost.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('PowerShift Dual-Clutch Gearbox', 'The Powershift DCT fitted to Focus and Fiesta (2010–2016) is notorious for shudder and hesitation at low speeds. Avoid examples with this symptom.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('Rust on Wheel Arches & Sills', 'Older Fiestas, Focuses and Mondeos can suffer significant rust on sills, rear arches, and rear bumper mounting areas.', 'medium', ['COMMON_ISSUE']),
    item('Front Suspension Wear', 'Front lower wishbone ball joints and anti-roll bar links wear quickly, causing knocking over bumps. Repair is inexpensive but check carefully.', 'medium', ['COMMON_ISSUE']),
  ]),
  highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
    item('PowerShift Shudder Test', 'At very low speed in a car park, maintain light throttle from a standstill. Any shudder or vibration at 5–15 mph is a major red flag for this gearbox.', 'high', ['HIGH_ATTENTION']),
    item('Coolant Condition (EcoBoost)', 'Check the coolant reservoir for oily residue or mayonnaise-like deposits indicating head gasket seepage.', 'high', ['HIGH_ATTENTION']),
    item('Rust Under Body', 'Get underneath or use an inspection mirror to check sills, floor pan junctions, and rear subframe mounts.', 'medium', ['HIGH_ATTENTION']),
  ]),
  visualAttention: section('visualAttention', 'Visual Attention Areas', [
    item('Sills at the Front Jack Point', 'Fords commonly rust through the sill at the front jacking point. Poke the metal gently with a key, soft or flaking metal is structural failure.', 'high', ['VISUAL_CHECK']),
    item('Rear Arch Inner Surface', 'The inner surface of rear arches traps mud and can rot from the inside out. Look with a torch into the wheel arch cavity.', 'medium', ['VISUAL_CHECK']),
  ]),
  mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
    item('1.6 TDCi Timing Belt', 'If diesel with the 1.6 TDCi, timing belt replacement interval is 100k miles but many recommend 60k. Confirm the service date.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
    item('EGR Valve (diesel)', 'EGR valves coke up causing hesitation and limp mode. Cleaning or replacement: £150–£400. Ask about any hesitation history.', 'medium', ['COMMON_ISSUE']),
  ]),
  testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
    item('PowerShift From Rest', 'The most critical test. Drive slowly from a standstill on light throttle. Any vibration or shudder at under 20 mph means the clutch pack needs replacement.', 'high', ['TEST_DRIVE']),
    item('Front Suspension Over Bumps', 'Drive slowly over speed bumps and listen for knocking. Any metallic knock from the front suggests worn ball joints or anti-roll bar links.', 'medium', ['TEST_DRIVE']),
  ]),
  costAwareness: section('costAwareness', 'Cost Awareness', [
    item('PowerShift Clutch Pack Replacement', 'Dual-clutch replacement: £1,200–£2,500 at an independent. A full gearbox remanufacture is £3,000+. This is a major negotiating point.', 'high', ['EXPENSIVE_RISK']),
    item('EcoBoost Head Gasket', 'Head gasket replacement on 1.0 EcoBoost: £700–£1,500. Catch it early, overheating destroys the head.', 'high', ['EXPENSIVE_RISK']),
  ]),
}

// ─── Generic fallback ─────────────────────────────────────────────────────────

function buildGenericResult(make: string, model: string, year: number): VehicleResearchResult {
  const vehicleKey = `${year} ${make} ${model}`
  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    confidence: 'low',
    overallRiskLevel: 'moderate',
    summary: `Detailed AI research for the ${vehicleKey} is temporarily unavailable. The guide below covers universal inspection priorities that apply to all used vehicles. Always verify findings with a qualified mechanic.`,
    sections: {
      commonProblems: section('commonProblems', 'Common Problems', [
        item('Engine Oil Consumption', 'Many engines consume oil between service intervals. Check the dipstick; if it is below the minimum mark, this indicates an issue that should be investigated.', 'medium', ['COMMON_ISSUE']),
        item('Automatic Transmission Wear', 'Automatic gearboxes deteriorate without regular fluid changes. Hesitation, rough shifts, or slipping are warning signs requiring specialist inspection.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Rust on Structural Areas', 'Rust on sills, subframes, and floor pans affects structural integrity. Cosmetic rust is different, learn to distinguish surface from penetrating rust.', 'medium', ['COMMON_ISSUE']),
      ]),
      highPriorityChecks: section('highPriorityChecks', 'High-Priority Checks', [
        item('Service History, Verify Every Entry', 'Cross-reference stamps with receipts where possible. A gap in service history on a complex vehicle is a negotiation point.', 'high', ['HIGH_ATTENTION']),
        item('OBD Diagnostic Scan', 'A basic OBD reader reveals stored and pending fault codes. Do this before the test drive. Clear codes can mask recurring problems.', 'high', ['HIGH_ATTENTION']),
        item('Independent Pre-Purchase Inspection', 'A mechanic inspection (£100–£200) is the single best investment before any used car purchase over £3,000.', 'high', ['HIGH_ATTENTION']),
      ]),
      visualAttention: section('visualAttention', 'Visual Attention Areas', [
        item('Paint Thickness & Panel Colour Match', 'Stand back and look along the panels in good light. Any colour variation or orange peel differences indicate body repair. A paint depth meter is ideal.', 'medium', ['VISUAL_CHECK']),
        item('Underneath, Fluid Leaks & Rust', 'Inspect the underside with a torch. Look for fresh oil spots, coolant staining, and any rust on the subframe or floor pan.', 'high', ['VISUAL_CHECK']),
        item('Tyre Condition & Wear Pattern', 'Uneven wear across the tread indicates alignment or suspension problems. Check age stamps on the sidewall, tyres over 6 years old should be replaced regardless of tread.', 'medium', ['VISUAL_CHECK']),
      ]),
      mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanical Watchouts', [
        item('Timing Belt / Chain Service', 'Confirm whether the engine uses a belt or chain, and if it is a belt, when it was last changed. Missed interval = catastrophic engine failure risk.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Cooling System Condition', 'Check that the coolant is the correct colour and the level is stable. A cold engine should never require topping up between services.', 'high', ['COMMON_ISSUE']),
        item('Clutch Feel (manual gearbox)', 'For manual cars, the clutch should engage smoothly in the lower third of pedal travel. Engagement very high up indicates a worn clutch near the end of its life.', 'medium', ['COMMON_ISSUE']),
      ]),
      testDriveFocus: section('testDriveFocus', 'Test Drive Focus', [
        item('Cold Start Behaviour', 'Start the car cold. Excessive smoke, rough idle, or warning lights at startup are immediate red flags. Do not let the seller warm the car up before your arrival.', 'high', ['TEST_DRIVE']),
        item('Emergency Braking Test', 'Find a safe empty area and brake firmly from 30 mph. The car should stop straight with no pulling, vibration, or ABS pulsing on dry road.', 'high', ['TEST_DRIVE']),
        item('Acceleration & Gear Changes', 'Accelerate through the full rev range in lower gears. Any hesitation, smoke, or unusual noise under load points to engine or drivetrain issues.', 'medium', ['TEST_DRIVE']),
      ]),
      costAwareness: section('costAwareness', 'Cost Awareness', [
        item('Timing Belt Replacement', 'If overdue or unknown: budget £400–£800 for a belt-driven engine. Non-negotiable before purchase for safety.', 'high', ['EXPENSIVE_RISK']),
        item('Full Service at Purchase', 'Budget for a full service (oil, filters, brake fluid, spark plugs) at purchase regardless of the stated service date. Cost: £200–£400 at an independent garage.', 'medium', ['EXPENSIVE_RISK']),
        item('Pre-Purchase Inspection', 'An independent inspection by a marque specialist is £100–£250. This fee saves thousands by catching hidden faults before you sign.', 'medium', ['HIGH_ATTENTION']),
      ]),
    },
    disclaimer: 'This guide is based on general vehicle inspection principles due to limited vehicle-specific data. Use as a starting checklist only, always verify with a qualified mechanic before purchase.',
  }
}

function buildGermanGenericResult(make: string, model: string, year: number): VehicleResearchResult {
  const vehicleKey = `${year} ${make} ${model}`
  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    confidence: 'low',
    overallRiskLevel: 'moderate',
    summary: `Detaillierte KI-Analyse für den ${vehicleKey} ist vorübergehend nicht verfügbar. Der folgende Leitfaden behandelt universelle Prüfprioritäten für Gebrauchtwagen.`,
    sections: {
      commonProblems: section('commonProblems', 'Häufige Probleme', [
        item('Motorölverbrauch', 'Viele Motoren verbrauchen zwischen den Ölwechseln Öl. Ölstand prüfen; liegt er unter dem Minimalstand, sollte dies untersucht werden.', 'medium', ['COMMON_ISSUE']),
        item('Automatikgetriebe-Verschleiß', 'Automatikgetriebe verschleißen ohne regelmäßige Ölwechsel. Zögern, ruckartige Schaltvorgänge oder Schlupf sind Warnsignale, die ein Fachmann prüfen sollte.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Rost an tragenden Teilen', 'Rost an Schwellern, Hilfsrahmen und Bodenblech beeinträchtigt die Fahrzeugsicherheit. Oberflächenrost ist anders zu bewerten als durchfressende Korrosion.', 'medium', ['COMMON_ISSUE']),
      ]),
      highPriorityChecks: section('highPriorityChecks', 'Prioritätschecks', [
        item('Scheckheft lückenlos prüfen', 'Stempel mit Belegen vergleichen, soweit vorhanden. Servicelücken bei komplexen Fahrzeugen sind ein Verhandlungsargument.', 'high', ['HIGH_ATTENTION']),
        item('OBD-Diagnosescan', 'Ein einfaches OBD-Lesegerät zeigt gespeicherte und anstehende Fehlercodes. Vor der Probefahrt durchführen. Gelöschte Codes können auf wiederkehrende Probleme hinweisen.', 'high', ['HIGH_ATTENTION']),
        item('Unabhängige Vorführungsinspektion', 'Eine Inspektion durch einen unabhängigen Mechaniker (100–200 €) ist die beste Investition vor jedem Gebrauchtwagenkauf über 3.000 €.', 'high', ['HIGH_ATTENTION']),
      ]),
      visualAttention: section('visualAttention', 'Visuelle Prüfpunkte', [
        item('Lackschichtdicke und Farbübereinstimmung', 'Aus der Distanz entlang der Karosserie blicken. Farbabweichungen oder Orangenhaut deuten auf Karosseriereparaturen hin. Ein Lackschichtdickenmessgerät ist ideal.', 'medium', ['VISUAL_CHECK']),
        item('Unterboden – Ölspuren und Rost', 'Unterboden mit einer Taschenlampe inspizieren. Auf frische Ölflecken, Kühlmittelspuren und Rost am Hilfsrahmen oder Bodenblech achten.', 'high', ['VISUAL_CHECK']),
        item('Reifenzustand und Abnutzungsmuster', 'Ungleichmäßige Abnutzung weist auf Spur-, Fahrwerks- oder Dämpferprobleme hin. Auf das DOT-Datum achten – Reifen über 6 Jahre sollten ersetzt werden.', 'medium', ['VISUAL_CHECK']),
      ]),
      mechanicalWatchouts: section('mechanicalWatchouts', 'Mechanische Warnzeichen', [
        item('Zahnriemen / Steuerkette', 'Klären, ob Riemen oder Kette verbaut ist, und beim Riemen das letzte Wechseldatum bestätigen. Versäumter Wechseltermin bedeutet hohes Motorschadenrisiko.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Kühlsystem', 'Kühlmittel muss die richtige Farbe und einen stabilen Stand haben. Ein kalter Motor sollte nie zwischen den Services nachgefüllt werden müssen.', 'high', ['COMMON_ISSUE']),
        item('Kupplungsgefühl (Schaltgetriebe)', 'Die Kupplung sollte im unteren Pedaldrittel gleichmäßig greifen. Sehr hohes Einrasten oder Schlupf deutet auf eine abgenutzte Kupplung hin.', 'medium', ['COMMON_ISSUE']),
      ]),
      testDriveFocus: section('testDriveFocus', 'Probefahrt-Fokus', [
        item('Kaltstart-Verhalten', 'Fahrzeug kalt starten. Übermäßiger Rauch, unruhiger Leerlauf oder Warnleuchten beim Start sind sofortige Warnsignale. Verkäufer nicht das Fahrzeug vorwärmen lassen.', 'high', ['TEST_DRIVE']),
        item('Vollbremsungstest', 'Auf freier Strecke aus Tempo 50 fest bremsen. Das Fahrzeug sollte gerade zum Stehen kommen, ohne Ziehen, Vibrationen oder ungewöhnliches ABS-Pulsieren.', 'high', ['TEST_DRIVE']),
        item('Beschleunigung und Schaltvorgänge', 'Im unteren Gang durch den Drehzahlbereich beschleunigen. Zögern, Rauch oder ungewöhnliche Geräusche unter Last weisen auf Motor- oder Antriebsprobleme hin.', 'medium', ['TEST_DRIVE']),
      ]),
      costAwareness: section('costAwareness', 'Kostenbewusstsein', [
        item('Zahnriemenwechsel', 'Falls überfällig oder unbekannt: 400–800 € bei einem unabhängigen Betrieb einplanen. Vor dem Kauf nicht verhandelbar.', 'high', ['EXPENSIVE_RISK']),
        item('Großinspektion bei Kauf', 'Unabhängig vom angegebenen Servicestand eine Inspektion (Öl, Filter, Bremsflüssigkeit, Zündkerzen) einplanen: ca. 200–400 € in einer freien Werkstatt.', 'medium', ['EXPENSIVE_RISK']),
        item('Vorführungsinspektion', 'Eine Inspektion durch einen Markenfachbetrieb kostet 100–250 € und kann teure versteckte Mängel aufdecken.', 'medium', ['HIGH_ATTENTION']),
      ]),
    },
    disclaimer: 'Dieser Leitfaden basiert auf allgemeinen Fahrzeuginspektionsgrundsätzen, da fahrzeugspezifische Daten begrenzt verfügbar sind. Nur als Ausgangscheckliste verwenden – vor dem Kauf stets von einem qualifizierten Mechaniker prüfen lassen.',
  }
}

function buildAlbanianGenericResult(make: string, model: string, year: number): VehicleResearchResult {
  const vehicleKey = `${year} ${make} ${model}`
  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    confidence: 'low',
    overallRiskLevel: 'moderate',
    summary: `Analiza e detajuar e AI për ${vehicleKey} është përkohësisht e padisponueshme. Udhëzuesi më poshtë mbulon prioritetet universale të inspektimit për makinat e përdorura.`,
    sections: {
      commonProblems: section('commonProblems', 'Problemet e Zakonshme', [
        item('Konsumimi i vajit të motorit', 'Shumë motorë konsumojnë vaj ndërmjet ndërrimit. Kontrolloni shufërën; nëse është nën minimum, ky problem duhet hetuar.', 'medium', ['COMMON_ISSUE']),
        item('Konsumimi i transmisionit automatik', 'Kutitë e marsheve automatike prishen pa ndërrime të rregullta të vajit. Vonesa, ndërrime të forta ose rrëshqitja janë shenja paralajmëruese.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Ndryshku në zonat strukturore', 'Ndryshku në pragje, kornizat dhe dyshemenë ndikon në sigurinë strukturore. Mësoni të dalloni ndryshkun sipërfaqësor nga ai depërtues.', 'medium', ['COMMON_ISSUE']),
      ]),
      highPriorityChecks: section('highPriorityChecks', 'Kontrollet Prioritare', [
        item('Libri i shërbimit – verifikoni çdo hyrje', 'Krahasoni stampat me faturat kur është e mundur. Boshllëqet në historikun e shërbimit janë pikë negocimi.', 'high', ['HIGH_ATTENTION']),
        item('Skanim diagnostik OBD', 'Një lexues bazë OBD zbulon kodet e gabimeve të ruajtura dhe në pritje. Bëjeni para provës. Kodet e fshira mund të fshehin probleme të përsëritura.', 'high', ['HIGH_ATTENTION']),
        item('Inspektim i pavarur para blerjes', 'Një inspektim nga mekanik i pavarur (100–200 €) është investimi më i mirë para blerjes së çdo makine mbi 3.000 €.', 'high', ['HIGH_ATTENTION']),
      ]),
      visualAttention: section('visualAttention', 'Pikat e Vëmendjes Vizuale', [
        item('Trashësia e bojës dhe përputhshmëria e ngjyrës', 'Shikoni nga larg sipas paneleve. Çdo ndryshim ngjyre ose lëkurë portokalli tregon riparim karoserish.', 'medium', ['VISUAL_CHECK']),
        item('Nëntoka – rrjedhje dhe ndryshk', 'Inspektoni nëntokën me një dritë. Kërkoni pika të reja vaji, njolla ftohësi dhe ndryshk në kornizë ose dysheme.', 'high', ['VISUAL_CHECK']),
        item('Gjendja e gomave dhe modeli i konsumit', 'Konsumi i pabarabartë tregon probleme me drejtimin ose pezullimin. Kontrolloni datën e prodhimit – gomat mbi 6 vjet duhen zëvendësuar.', 'medium', ['VISUAL_CHECK']),
      ]),
      mechanicalWatchouts: section('mechanicalWatchouts', 'Sinjalet Mekanike', [
        item('Rripi / zinxhiri i shpërndarjes', 'Konfirmoni nëse motori përdor rripin ose zinxhirin dhe kur është ndërruar rripi herën e fundit. Intervali i humbur = rrezik i lartë i dëmtimit të motorit.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item('Gjendja e sistemit të ftohjes', 'Lëngu i ftohjes duhet të ketë ngjyrën e duhur dhe nivel të qëndrueshëm. Motori i ftohtë kurrë nuk duhet të kërkojë mbushje ndërmjet shërbimeve.', 'high', ['COMMON_ISSUE']),
        item('Ndijimi i friksionit (transmision manual)', 'Friksioni duhet të angazhohet butësisht në të tretat e poshtme të lëvizjes. Angazhimi shumë lart ose rrëshqitja tregon friksion të konsumuar.', 'medium', ['COMMON_ISSUE']),
      ]),
      testDriveFocus: section('testDriveFocus', 'Fokusi i Vozitjes Provë', [
        item('Sjellja e startimit të ftohtë', 'Startoni makinën të ftohtë. Tymi i tepruar, ralanti i parregullt ose dritat e paralajmërimit janë sinjale të menjëhershme. Mos lejoni shitësin ta ngrohë.', 'high', ['TEST_DRIVE']),
        item('Testi i frenimit emergjent', 'Gjeni një zonë të sigurt dhe frenoni fort nga 50 km/h. Makina duhet të ndalojë drejt pa tërhequr, dridhje ose pulsim të ABS.', 'high', ['TEST_DRIVE']),
        item('Nxitimi dhe ndërrimi i marsheleve', 'Nxitoni nëpër rangun e rrotullimeve në marsheve të ulëta. Çdo hezitim, tym ose zhurmë e pazakontë nën ngarkesë tregon probleme me motorin ose transmisionin.', 'medium', ['TEST_DRIVE']),
      ]),
      costAwareness: section('costAwareness', 'Ndërgjegjësimi i Kostove', [
        item('Ndërrimi i rripit të shpërndarjes', 'Nëse i vonuar ose i panjohur: buxhetoni 400–800 € për motor me rrip. Jo i negociueshëm para blerjes.', 'high', ['EXPENSIVE_RISK']),
        item('Shërbim i plotë në blerje', 'Buxhetoni për shërbim të plotë (vaj, filtra, lëng frenash, kandelat) pavarësisht datës së shërbimit të deklaruar. Kosto: 200–400 € në garazh të pavarur.', 'medium', ['EXPENSIVE_RISK']),
        item('Inspektim para blerjes', 'Inspektimi nga specialist i markës kushton 100–250 € dhe mund të zbulojë defekte të fshehura të shtrenjta.', 'medium', ['HIGH_ATTENTION']),
      ]),
    },
    disclaimer: 'Ky udhëzues bazohet në parimet e përgjithshme të inspektimit të automjeteve për shkak të të dhënave të kufizuara specifike për modelin. Përdoreni vetëm si listë fillestare – gjithmonë verifikoni me një mekanik të kualifikuar para blerjes.',
  }
}

function buildLocalizedGenericResult(make: string, model: string, year: number, locale?: string): VehicleResearchResult {
  const lang = normalizeLocale(locale)
  if (lang === 'de') return buildGermanGenericResult(make, model, year)
  if (lang === 'sq') return buildAlbanianGenericResult(make, model, year)
  if (lang === 'bg') {
    const vehicleKey = `${year} ${make} ${model}`
    return {
      vehicleKey,
      generatedAt: new Date().toISOString(),
      confidence: 'low',
      overallRiskLevel: 'moderate',
      summary: `Подробното AI проучване за ${vehicleKey} в момента не е налично. Ръководството по-долу покрива универсалните приоритети при оглед на употребяван автомобил.`,
      sections: {
        commonProblems: section('commonProblems', 'Чести проблеми', [
          item('Разход на моторно масло', 'Проверете нивото на маслото и следи от течове. Ниско ниво или пресни следи от масло са сигнал за проблем, който трябва да се провери допълнително.', 'medium', ['COMMON_ISSUE']),
          item('Износване на автоматичната скоростна кутия', 'Забавяне, придърпване или приплъзване при смяна на предавките изискват оглед от специалист по трансмисии.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
          item('Ръжда по носещите елементи', 'Огледайте праговете, пода, носачите и ръбовете на калниците. Повърхностната ръжда е едно, но дълбоката корозия вече е риск за безопасността.', 'medium', ['COMMON_ISSUE']),
        ]),
        highPriorityChecks: section('highPriorityChecks', 'Приоритетни проверки', [
          item('Сервизна история', 'Сравнете сервизната книжка, фактурите и километража. Празнини в сервизната история са силен аргумент при преговори.', 'high', ['HIGH_ATTENTION']),
          item('OBD диагностика', 'Прочетете активните и запаметените грешки преди тестово каране. Наскоро изтрити грешки могат да прикриват повтарящи се дефекти.', 'high', ['HIGH_ATTENTION']),
          item('Независим преглед преди покупка', 'Прегледът при независим механик е най-сигурната стъпка преди покупка на по-скъп употребяван автомобил.', 'high', ['HIGH_ATTENTION']),
        ]),
        visualAttention: section('visualAttention', 'Визуални точки за внимание', [
          item('Разлики в боята и фугите между панелите', 'Гледайте автомобила на дневна светлина от няколко ъгъла. Разлика в оттенъка, неравни фуги или следи от пребоядисване могат да означават ремонт на купето.', 'medium', ['VISUAL_CHECK']),
          item('Под, течове и корозия', 'С фенер огледайте пода, следите от масло, охладителна течност и състоянието на носещите елементи.', 'high', ['VISUAL_CHECK']),
          item('Гуми и модел на износване', 'Неравномерното износване на гумите подсказва проблем с геометрията, окачването или амортисьорите.', 'medium', ['VISUAL_CHECK']),
        ]),
        mechanicalWatchouts: section('mechanicalWatchouts', 'Механични проверки', [
          item('Ангренажен ремък или верига', 'Потвърдете дали моторът е с ремък или верига и кога е обслужван последно. Пропуснат интервал може да доведе до тежка повреда на двигателя.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
          item('Охладителна система', 'Охладителната течност трябва да е с правилен цвят и стабилно ниво. Честото доливане не е нормално.', 'high', ['COMMON_ISSUE']),
          item('Съединител при ръчна кутия', 'Съединителят трябва да отделя плавно и предвидимо. Високото отделяне или приплъзването показват, че е към края си.', 'medium', ['COMMON_ISSUE']),
        ]),
        testDriveFocus: section('testDriveFocus', 'Фокус при тестово каране', [
          item('Студен старт', 'Стартирайте двигателя студен. Прекомерен дим, неравномерна работа или предупредителни лампи са сериозни сигнали.', 'high', ['TEST_DRIVE']),
          item('Спиране', 'При безопасно спиране автомобилът трябва да остане стабилен и праволинеен, без вибрации, дърпане или пулсации в педала.', 'high', ['TEST_DRIVE']),
          item('Ускорение и смяна на предавките', 'Ускорете през ниските предавки. Прекъсване, дим или необичаен шум под натоварване сочат проблем с двигателя или задвижването.', 'medium', ['TEST_DRIVE']),
        ]),
        costAwareness: section('costAwareness', 'Разходи и преговори', [
          item('Голямо обслужване', 'Ако интервалът е неизвестен или просрочен, включете голямо обслужване в преговорите преди покупка.', 'high', ['EXPENSIVE_RISK']),
          item('Базов сервиз веднага след покупка', 'Планирайте смяна на масло, филтри, спирачна течност и основни консумативи независимо от твърденията на продавача.', 'medium', ['EXPENSIVE_RISK']),
          item('Преглед при специалист', 'Специалист по марката може да открие скрити дефекти, които не се виждат при кратко пробно каране.', 'medium', ['HIGH_ATTENTION']),
        ]),
      },
      disclaimer: 'Това ръководство се основава на общи правила за оглед на автомобили, защото подробни данни за конкретния модел не са налични. Използвайте го като начална рамка и потвърдете състоянието с квалифициран механик преди покупка.',
    }
  }
  if (lang !== 'sr' && lang !== 'mk') return buildGenericResult(make, model, year)

  const vehicleKey = `${year} ${make} ${model}`
  const sr = lang === 'sr'

  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    confidence: 'low',
    overallRiskLevel: 'moderate',
    summary: sr
      ? `Detaljno AI istraživanje za ${vehicleKey} trenutno nije dostupno. Vodič ispod pokriva univerzalne prioritete pregleda polovnih vozila.`
      : `Деталното AI истражување за ${vehicleKey} моментално не е достапно. Водичот подолу ги покрива универзалните приоритети за преглед на половни возила.`,
    sections: {
      commonProblems: section('commonProblems', sr ? 'Česti problemi' : 'Чести проблеми', [
        item(sr ? 'Potrošnja motornog ulja' : 'Потрошувачка на моторно масло', sr ? 'Proverite nivo ulja i tragove curenja. Nizak nivo ili sveži tragovi ulja ukazuju na problem koji treba dodatno proveriti.' : 'Проверете го нивото на масло и траги од истекување. Ниско ниво или свежи траги од масло укажуваат на проблем што треба дополнително да се провери.', 'medium', ['COMMON_ISSUE']),
        item(sr ? 'Habanje automatskog menjača' : 'Абење на автоматскиот менувач', sr ? 'Kašnjenje, trzaji ili proklizavanje pri promeni stepena prenosa zahtevaju pregled specijaliste za menjače.' : 'Доцнење, трзање или пролизгување при менување брзини бара преглед кај специјалист за менувачи.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item(sr ? 'Rđa na nosećim delovima' : 'Рѓа на носечки делови', sr ? 'Pregledajte pragove, pod, nosače i rubove blatobrana. Površinska rđa je jedno, a dubinska korozija može biti bezbednosni problem.' : 'Проверете прагови, под, носачи и рабови на крила. Површинската рѓа е едно, а длабоката корозија може да биде безбедносен проблем.', 'medium', ['COMMON_ISSUE']),
      ]),
      highPriorityChecks: section('highPriorityChecks', sr ? 'Prioritetne provere' : 'Приоритетни проверки', [
        item(sr ? 'Servisna istorija' : 'Сервисна историја', sr ? 'Uporedite servisnu knjižicu, račune i kilometražu. Praznine u istoriji servisa su važna osnova za pregovore.' : 'Споредете сервисна книшка, сметки и километража. Празнини во сервисната историја се важна основа за преговори.', 'high', ['HIGH_ATTENTION']),
        item(sr ? 'OBD dijagnostika' : 'OBD дијагностика', sr ? 'Očitajte aktivne i zapamćene greške pre test vožnje. Nedavno obrisane greške mogu prikriti ponavljajuće kvarove.' : 'Прочитајте активни и запаметени грешки пред тест возење. Неодамна избришани грешки може да прикријат повторливи дефекти.', 'high', ['HIGH_ATTENTION']),
        item(sr ? 'Nezavisan pregled pre kupovine' : 'Независен преглед пред купување', sr ? 'Pregled kod nezavisnog mehaničara je najbezbedniji korak pre kupovine skupljeg polovnog vozila.' : 'Преглед кај независен механичар е најбезбеден чекор пред купување поскапо половно возило.', 'high', ['HIGH_ATTENTION']),
      ]),
      visualAttention: section('visualAttention', sr ? 'Vizuelne tačke pažnje' : 'Визуелни точки за внимание', [
        item(sr ? 'Razlika u boji i zazorima panela' : 'Разлика во боја и празнини меѓу панели', sr ? 'Gledajte vozilo iz više uglova na dnevnom svetlu. Razlike u nijansi, neravni zazori ili narandžasta kora mogu ukazati na popravku karoserije.' : 'Гледајте го возилото од повеќе агли на дневна светлина. Разлики во нијанса, нерамни празнини или портокалова кора може да укажуваат на каросериска поправка.', 'medium', ['VISUAL_CHECK']),
        item(sr ? 'Podvozje, curenja i korozija' : 'Подвозје, истекувања и корозија', sr ? 'Baterijskom lampom proverite podvozje, tragove ulja, rashladne tečnosti i stanje nosača.' : 'Со батериска ламба проверете подвозје, траги од масло, разладна течност и состојба на носачи.', 'high', ['VISUAL_CHECK']),
        item(sr ? 'Gume i obrazac habanja' : 'Гуми и шема на абење', sr ? 'Neravnomerno habanje guma ukazuje na problem sa trapom, geometrijom ili amortizerima.' : 'Нерамномерно абење на гумите укажува на проблем со подвесување, геометрија или амортизери.', 'medium', ['VISUAL_CHECK']),
      ]),
      mechanicalWatchouts: section('mechanicalWatchouts', sr ? 'Mehaničke provere' : 'Механички проверки', [
        item(sr ? 'Zupčasti kaiš ili lanac' : 'Ремен или ланец за развод', sr ? 'Potvrdite da li motor koristi kaiš ili lanac i kada je poslednji put servisiran. Propušten interval može izazvati težak kvar motora.' : 'Потврдете дали моторот користи ремен или ланец и кога последен пат е сервисиран. Пропуштен интервал може да предизвика тежок дефект на моторот.', 'high', ['COMMON_ISSUE', 'EXPENSIVE_RISK']),
        item(sr ? 'Rashladni sistem' : 'Систем за ладење', sr ? 'Rashladna tečnost mora biti odgovarajuće boje i stabilnog nivoa. Često dolivanje nije normalno.' : 'Разладната течност мора да има соодветна боја и стабилно ниво. Често долевање не е нормално.', 'high', ['COMMON_ISSUE']),
        item(sr ? 'Kvačilo kod manuelnog menjača' : 'Спојка кај мануелен менувач', sr ? 'Kvačilo treba da hvata glatko i predvidljivo. Visoko hvatanje ili proklizavanje znači da je pri kraju.' : 'Спојката треба да фаќа мазно и предвидливо. Високо фаќање или пролизгување значи дека е при крај.', 'medium', ['COMMON_ISSUE']),
      ]),
      testDriveFocus: section('testDriveFocus', sr ? 'Fokus na test vožnji' : 'Фокус на тест возење', [
        item(sr ? 'Hladan start' : 'Ладен старт', sr ? 'Startujte motor hladan. Preteran dim, neravnomeran rad ili lampice upozorenja su ozbiljni signali.' : 'Стартувајте го моторот ладен. Прекумерен чад, нерамномерен работ или предупредувачки ламби се сериозни сигнали.', 'high', ['TEST_DRIVE']),
        item(sr ? 'Kočenje' : 'Сопирање', sr ? 'Pri bezbednom kočenju auto treba da ostane pravolinijski, bez vibracija, zanošenja ili pulsiranja pedale.' : 'При безбедно сопирање автомобилот треба да остане праволиниски, без вибрации, влечење на страна или пулсирање на педалата.', 'high', ['TEST_DRIVE']),
        item(sr ? 'Ubrzanje i promene brzina' : 'Забрзување и менување брзини', sr ? 'Ubrzajte kroz niže stepene prenosa. Zastajkivanje, dim ili neobični zvuci pod opterećenjem ukazuju na motor ili pogon.' : 'Забрзајте низ пониските брзини. Задржување, чад или необични звуци под оптоварување укажуваат на мотор или погон.', 'medium', ['TEST_DRIVE']),
      ]),
      costAwareness: section('costAwareness', sr ? 'Troškovi i pregovori' : 'Трошоци и преговори', [
        item(sr ? 'Veliki servis' : 'Голем сервис', sr ? 'Ako je interval nepoznat ili prekoračen, uračunajte veliki servis u pregovore pre kupovine.' : 'Ако интервалот е непознат или надминат, вклучете голем сервис во преговорите пред купување.', 'high', ['EXPENSIVE_RISK']),
        item(sr ? 'Osnovni servis odmah posle kupovine' : 'Основен сервис веднаш по купување', sr ? 'Planirajte zamenu ulja, filtera, kočione tečnosti i osnovnih potrošnih delova bez obzira na tvrdnje prodavca.' : 'Планирајте замена на масло, филтри, течност за сопирачки и основни потрошни делови без оглед на тврдењата на продавачот.', 'medium', ['EXPENSIVE_RISK']),
        item(sr ? 'Pregled kod specijaliste' : 'Преглед кај специјалист', sr ? 'Specijalista za marku može otkriti skrivene kvarove koji nisu vidljivi na kratkoj probnoj vožnji.' : 'Специјалист за марката може да открие скриени дефекти што не се видливи на кратко пробно возење.', 'medium', ['HIGH_ATTENTION']),
      ]),
    },
    disclaimer: sr
      ? 'Ovaj vodič je zasnovan na opštim pravilima pregleda vozila jer detaljni podaci za model nisu dostupni. Koristite ga kao početnu listu i proverite vozilo kod kvalifikovanog mehaničara pre kupovine.'
      : 'Овој водич е заснован на општи правила за преглед на возила бидејќи детални податоци за моделот не се достапни. Користете го како почетна листа и проверете го возилото кај квалификуван механичар пред купување.',
  }
}

// ─── Brand matcher ────────────────────────────────────────────────────────────

function buildBrandResult(make: string, model: string, year: number): VehicleResearchResult {
  const vehicleKey = `${year} ${make} ${model}`
  const m = make.toLowerCase()

  const BRAND_MAP: Record<string, typeof BMW_KNOWLEDGE> = {
    bmw:       BMW_KNOWLEDGE,
    mercedes:  MERCEDES_KNOWLEDGE,
    audi:      AUDI_VW_KNOWLEDGE,
    volkswagen: AUDI_VW_KNOWLEDGE,
    vw:        AUDI_VW_KNOWLEDGE,
    skoda:     AUDI_VW_KNOWLEDGE,
    seat:      AUDI_VW_KNOWLEDGE,
    toyota:    TOYOTA_KNOWLEDGE,
    lexus:     TOYOTA_KNOWLEDGE,
    ford:      FORD_KNOWLEDGE,
  }

  const knowledge = BRAND_MAP[m]
  if (!knowledge) return buildGenericResult(make, model, year)

  return {
    vehicleKey,
    generatedAt: new Date().toISOString(),
    confidence: 'medium',
    overallRiskLevel: 'moderate',
    summary: `The ${vehicleKey} is covered by our model knowledge base. The guide below reflects commonly reported issues for this brand generation. AI live data is temporarily unavailable, findings are based on known patterns.`,
    sections: knowledge,
    disclaimer: 'This guide is based on our built-in knowledge base for this vehicle brand. Findings reflect commonly reported issues and may not reflect all individual variants. AI live analysis was unavailable at the time of generation. Always verify with a qualified mechanic.',
  }
}

// ─── Public entry point ───────────────────────────────────────────────────────

export function generateFallbackResult(params: {
  make: string
  model: string
  year: number
  engine?: string
  trim?: string
  locale?: string
}): VehicleResearchResult {
  const lang = normalizeLocale(params.locale)
  // Non-English locales: always use localized generic content so users don't
  // see English-only fallback text when the AI is unavailable.
  if (lang === 'sr' || lang === 'mk' || lang === 'de' || lang === 'sq' || lang === 'bg') {
    return buildLocalizedGenericResult(params.make, params.model, params.year, params.locale)
  }

  return buildBrandResult(params.make, params.model, params.year)
}
