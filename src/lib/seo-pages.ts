// =============================================================================
// SEO page content registry
// Each entry maps a URL slug to structured, human-readable page content.
// Add entries here to create new SEO pages — the [slug] route renders them.
// =============================================================================

export interface SeoSection {
  heading: string
  body:     string
  bullets?: string[]
}

export interface SeoPageData {
  slug:            string
  metaTitle:       string
  metaDescription: string
  keywords:        string
  h1:              string
  lead:            string
  sections:        SeoSection[]
  ctaHeading:      string
  ctaBody:         string
  disclaimer?:     string
}

const PAGES: SeoPageData[] = [

  // ── 1 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'used-car-inspection',
    metaTitle:       'Used Car Inspection Guide | Used Cars Doctor',
    metaDescription: 'A complete guide to inspecting a used car before you buy. Covers exterior, interior, mechanical checks, documents, and what to look for at each stage.',
    keywords:        'used car inspection, how to inspect a used car, pre-purchase inspection, car buying guide',
    h1:              'Used Car Inspection: What to Check Before You Buy',
    lead:            'Buying a used car is one of the largest financial decisions many people make. A careful inspection before signing anything can save thousands in hidden repairs and protect you from cars with undisclosed damage or a troubled ownership history. This guide walks through every area worth checking.',
    sections: [
      {
        heading: 'Why a Thorough Inspection Matters',
        body:    'Private and dealer listings rarely highlight problems. Rust, repainted panels, worn brakes, and oil leaks are all easy to overlook on a casual visit. A structured inspection changes that — it turns a stressful experience into a systematic one, and gives you documented evidence to negotiate price or walk away with confidence.',
      },
      {
        heading: 'Exterior: What to Look For',
        body:    'The exterior tells a significant story. Walk around the car methodically rather than looking at it as a whole. Focus on:',
        bullets: [
          'Panel gaps — consistent, even spacing is the factory standard. Uneven gaps often indicate a collision repair.',
          'Paint condition — look along each panel at a shallow angle in daylight. Ripples, colour mismatch, overspray near rubber trims, or a slightly different sheen on one panel all suggest previous bodywork.',
          'Rust — check wheel arches, door sills, and the underside if accessible. Surface rust can be managed; structural rust is a serious concern.',
          'Glass — chips and cracks in the windshield can spread, are expensive to replace, and may fail an MOT or roadworthy test.',
          'Tyres — check tread depth and look for uneven wear patterns, which can signal alignment or suspension issues.',
        ],
      },
      {
        heading: 'Interior: Signs of Wear and Damage',
        body:    'The interior reveals how a car has been used. Worn pedal rubbers and a worn driver\'s seat combined with low mileage on the odometer is a classic sign of a rolled-back odometer. Check:',
        bullets: [
          'Seat condition, headliner, carpet edges, and boot lining for damp or water staining.',
          'All dashboard warning lights — turn the ignition on before starting the engine and confirm the lights come on then extinguish normally.',
          'Every button, switch, window, and lock — small electrical faults are easy to miss but can be expensive to diagnose.',
          'Any unusual smells: mould, burning, fuel, or stale cigarette smoke.',
        ],
      },
      {
        heading: 'Mechanical: Cold Start and Fluids',
        body:    'Ask to see the car with a cold engine if possible. A cold start is the most honest reading of engine health. Listen for rattling, knocking, or excessive smoke on startup. Then check:',
        bullets: [
          'Oil — wipe the dipstick, check colour and level. Black sludge or a milky appearance are warning signs.',
          'Coolant reservoir — low level or oily residue can indicate a head gasket issue.',
          'Brakes and suspension — compress each corner of the car by hand. One or two bounces after release is normal; continued bouncing suggests worn shock absorbers.',
          'Any fluid leaks under the car after it has been standing.',
        ],
      },
      {
        heading: 'Documents and History',
        body:    'The paper trail matters as much as the physical condition. Always verify:',
        bullets: [
          'The VIN on the chassis, door pillar, and registration document match.',
          'The service history is genuine — look for dated stamps, invoices, and a consistent mileage progression.',
          'There is no outstanding finance on the vehicle.',
          'The car has not been declared a total write-off.',
          'The seller\'s name matches the registered keeper on the V5C or equivalent.',
        ],
      },
    ],
    ctaHeading: 'Run a Guided Inspection on Your Phone',
    ctaBody:    'Used Cars Doctor walks you through each inspection area step by step, analyses your photos with AI, and produces a confidence score and written report you can use when negotiating.',
    disclaimer: 'AI-assisted photo analysis is advisory only. It does not replace a physical inspection by a qualified mechanic or automotive technician.',
  },

  // ── 2 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'check-car-before-buying',
    metaTitle:       'How to Check a Car Before Buying | Used Cars Doctor',
    metaDescription: 'Practical steps to check a used car before you buy. Covers research, viewing, test drive, documents, and negotiation — so you buy with confidence.',
    keywords:        'check car before buying, used car buying guide, what to check before buying a used car',
    h1:              'How to Check a Car Before Buying',
    lead:            'Most used car problems are visible if you know where to look. The challenge is that buyers often view cars quickly, under pressure, and without a clear plan. This guide gives you a practical framework for every stage — from initial research to final negotiation.',
    sections: [
      {
        heading: 'Before You Visit: Do Your Research',
        body:    'Half the work happens before you leave home.',
        bullets: [
          'Check the asking price against comparable listings on local platforms. An unusually low price for the mileage and condition is worth questioning.',
          'Look up known issues for that specific engine code and generation, not just the model name. A 2014 Golf 2.0 TDI behaves very differently to a 2020 Golf 1.5 eTSI.',
          'Verify the VIN exists and matches the listing if the seller provides it upfront.',
          'Prepare your checklist. Arriving with a structured plan prevents you from being rushed through the inspection.',
        ],
      },
      {
        heading: 'First Impressions at the Viewing',
        body:    'The first few minutes tell you a lot. Where the car is being shown matters — private driveways, well-lit car parks, and daylight are your friends. Be cautious if a seller insists on a motorway layby, indoor showroom with poor lighting, or a rushed viewing. Note whether the car is freshly washed: a very clean engine bay or freshly painted underside in an otherwise tatty car can indicate an attempt to hide oil leaks or corrosion.',
      },
      {
        heading: 'What to Check Systematically',
        body:    'Work through the car in a fixed order rather than where your eye is drawn. Exterior panels and gaps first, then glass, then tyres and wheels, then under the bonnet, then interior and electronics, then under the car if accessible.',
        bullets: [
          'Compare the gap width on both sides of each panel — doors, bonnet, boot lid, and bumpers.',
          'Run your hand along door and wing surfaces with eyes closed. Ripples you cannot see are sometimes felt clearly.',
          'Open every door, the bonnet, and the boot — check for alignment and that hinges are not forced.',
          'Check for moisture in headlight or tail-light housings, which can indicate cracks or poor seals.',
        ],
      },
      {
        heading: 'The Test Drive',
        body:    'A test drive should be long enough to warm the engine fully and include a mix of urban and faster road speeds. Key things to assess:',
        bullets: [
          'Braking — apply the brakes at various speeds and listen for grinding, vibration, or pulling to one side.',
          'Steering — on a straight, quiet road, briefly release the wheel to check the car tracks straight.',
          'Gearbox — for manual, work through all gears including reverse. For automatic, check for hesitation, harsh shifts, or slipping between changes.',
          'Suspension sounds — drive slowly over a speed bump and listen carefully with the radio off.',
          'Dash warning lights that appear once the engine is warm and under load.',
        ],
      },
      {
        heading: 'Documents to Verify',
        body:    'Never skip the paperwork. The service book, registration document, and any inspection or MOT history are your legal and financial protection.',
        bullets: [
          'Confirm the VIN on the car body matches the registration document exactly.',
          'Check that MOT or roadworthy test records show consistent mileage increments.',
          'If finance is outstanding on the vehicle, the lender — not the seller — may be the legal owner.',
          'Ask for and verify the last service receipts, not just the stamp in the service book.',
        ],
      },
      {
        heading: 'Using Findings to Negotiate',
        body:    'Every genuine fault you document is a negotiating point. Broken trim, worn tyres, a service overdue, or a cracked windshield all have a real cost to rectify. Arrive with an idea of what those repairs cost locally and use your findings to propose a fair adjusted price rather than just haggling on a round number.',
      },
    ],
    ctaHeading: 'Inspect Smarter with a Guided AI Checklist',
    ctaBody:    'Used Cars Doctor gives you a step-by-step inspection flow, AI photo analysis for visible damage, and a confidence report — so you go into every viewing prepared.',
  },

  // ── 3 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'car-inspection-checklist',
    metaTitle:       'Used Car Inspection Checklist | Used Cars Doctor',
    metaDescription: 'A complete used car inspection checklist covering exterior, interior, mechanical, test drive, and documents — every item that matters before you buy.',
    keywords:        'car inspection checklist, used car checklist, vehicle inspection checklist, pre-purchase checklist',
    h1:              'Used Car Inspection Checklist: Every Item That Matters',
    lead:            'A structured checklist turns a potentially overwhelming inspection into a reliable, repeatable process. Use this as a reference at every viewing — work through it in order, take notes, and photograph anything that raises a question.',
    sections: [
      {
        heading: 'Exterior Checklist',
        body:    'Start at the front of the car and work clockwise. In daylight if possible.',
        bullets: [
          'Panel gaps — even and consistent around all doors, bonnet, and boot.',
          'Paint — no colour mismatch, ripples, overspray near rubber seals, or visible blend lines.',
          'Rust — check wheel arches, door sills, B-pillars, and underside edges.',
          'Windscreen and glass — no chips larger than 10mm, no cracks, no fogging in sealed double-pane glass.',
          'Lights — all headlights, indicators, brake lights, reverse lights, and fog lights operational.',
          'Tyres — minimum legal tread depth on all four. Check for uneven wear across the width.',
          'Alloy wheels — for kerb damage or cracks, which can cause slow punctures or wheel vibration.',
          'Underbody — fresh undercoating on a high-mileage car can conceal structural rust.',
        ],
      },
      {
        heading: 'Interior Checklist',
        body:    'Check every functional element, not just the visible surfaces.',
        bullets: [
          'Seat condition — bolsters, stitching, adjustment mechanisms.',
          'Dashboard warning lights — confirm all extinguish after startup.',
          'Climate control — heating and cooling on all fan speeds and all vents.',
          'Infotainment — screen, Bluetooth, backup camera, USB connections.',
          'Windows — all four windows go up and down smoothly on the switch.',
          'Central locking — all doors lock and unlock consistently.',
          'Odometer reading — cross-reference against wear on pedals, steering wheel, and seat.',
          'Smells — damp, mould, oil, smoke, or burning indicate different problems.',
        ],
      },
      {
        heading: 'Mechanical Checklist',
        body:    'Start with a cold engine wherever possible.',
        bullets: [
          'Cold start — no extended cranking, rough idle longer than 20 seconds, or excessive exhaust smoke.',
          'Engine oil — check level and condition. Black or sludgy is a concern; milky indicates coolant contamination.',
          'Coolant — check reservoir level and look for oily residue on the cap or a brown frothy deposits.',
          'Brake fluid — low level may indicate worn brake pads or a leak.',
          'Timing belt or chain — ask when last changed and verify with documentation.',
          'Visible leaks — oil or coolant marks under the car after parking.',
          'Shock absorbers — press down sharply on each corner; the car should return to level in one motion.',
          'Exhaust smoke colour — blue (oil burning), white (coolant), black (rich fuelling) are all worth noting.',
        ],
      },
      {
        heading: 'Test Drive Checklist',
        body:    'At minimum 20 minutes, including varied road types. Radio off for most of it.',
        bullets: [
          'Straight-line tracking — hands briefly off the wheel on a clear road.',
          'Brake performance — firm pedal, no vibration, no pulling to one side.',
          'Gear changes — smooth through all ratios, no grinding, no slipping.',
          'Clutch bite point — not too high, not spongy.',
          'Steering — no vibration at speed, no excessive play.',
          'Suspension sounds — listen on speed bumps and rough surfaces.',
          'Engine response — no hesitation, stumbling, or power loss under acceleration.',
          'Warning lights — none should illuminate during or after the drive.',
        ],
      },
      {
        heading: 'Documents Checklist',
        body:    'The paperwork is as important as the physical car.',
        bullets: [
          'VIN matches the car body, dashboard plate, and registration document.',
          'Registration document — seller\'s name matches the registered keeper.',
          'Service history — dated stamps, invoices, and consistent mileage.',
          'MOT or roadworthy certificate history — no major advisories outstanding.',
          'Outstanding finance check — the lender may hold legal ownership if finance exists.',
          'Recall status — check the manufacturer\'s recall database for the VIN.',
        ],
      },
    ],
    ctaHeading: 'Use This Checklist Inside the App',
    ctaBody:    'Used Cars Doctor provides this checklist in a guided digital format. Work through it on your phone, add notes, and upload photos for AI analysis — all in one place.',
  },

  // ── 4 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'ai-car-inspection',
    metaTitle:       'AI Car Inspection: How It Works | Used Cars Doctor',
    metaDescription: 'How AI-powered car inspection works, what it can detect from photos, its limitations, and how to use it alongside a physical inspection for the best result.',
    keywords:        'AI car inspection, AI vehicle inspection, car damage detection AI, photo car inspection',
    h1:              'AI-Powered Car Inspection: How Technology Helps Buyers',
    lead:            'Artificial intelligence is changing how buyers evaluate used cars. AI tools can analyse photographs of a vehicle and identify visible signs of paint repairs, panel damage, and bodywork inconsistencies that a casual eye might miss. Understanding what AI can and cannot do helps you use it effectively.',
    sections: [
      {
        heading: 'What AI Can Detect from Photos',
        body:    'Modern AI vision models trained on large automotive datasets can recognise patterns that indicate specific types of damage or repair work. When applied to standardised vehicle photos, they look for:',
        bullets: [
          'Paint inconsistencies — variations in texture, sheen, or colour that suggest a panel has been resprayed.',
          'Panel alignment — gaps and edges that are not consistent with factory tolerances.',
          'Dents and deformation — surface contour changes across panel surfaces.',
          'Rust and corrosion indicators — discolouration and texture patterns on metal surfaces.',
          'Glass damage — cracks and chips in windscreens and windows.',
        ],
      },
      {
        heading: 'How the Photo Analysis Process Works',
        body:    'For reliable AI analysis, photo quality matters significantly. The best results come from standardised angles at consistent distances, natural daylight without harsh shadows, full panel visibility in frame, and sharp images without motion blur.',
        bullets: [
          'The AI processes each image and returns confidence-weighted findings, flagging areas that warrant closer attention.',
          'Results are presented with severity indicators to help you prioritise what to check in person.',
          'Multiple angles of the same panel improve accuracy and reduce false positives.',
        ],
      },
      {
        heading: 'Real Limitations You Should Understand',
        body:    'AI photo analysis is a powerful first filter, not a complete substitute for an experienced human inspection.',
        bullets: [
          'AI cannot assess mechanical condition — engine health, brake wear, suspension play, and fluid quality require physical examination.',
          'Poor photo quality significantly reduces accuracy — dark, blurry, or obstructed images may produce no result or a misleading one.',
          'AI cannot verify documents, check for outstanding finance, or confirm VIN matches.',
          'Surface damage hidden under bodywork, in door cavities, or under the vehicle is not visible to any camera.',
          'Results reflect what is visible in the submitted photos, not a comprehensive assessment of the vehicle.',
        ],
      },
      {
        heading: 'Using AI as Part of a Complete Inspection',
        body:    'The right way to use AI photo analysis is as one layer in a multi-stage process:',
        bullets: [
          'Use AI to identify areas that warrant closer attention before or during a physical inspection.',
          'Follow AI findings with hands-on checks — if the AI flags a panel, examine it in person, check the door shuts correctly, and probe the edges for filler.',
          'Always combine photo analysis with a mechanical inspection by a qualified technician for any significant purchase.',
          'Use the AI report as a negotiation document — flagged items with photographic evidence are concrete negotiating points.',
        ],
      },
    ],
    ctaHeading: 'Try AI Inspection on Your Next Car',
    ctaBody:    'Used Cars Doctor guides you through taking the right photos, runs AI analysis on each panel, and combines the results with your checklist responses into a single confidence score.',
    disclaimer: 'AI-generated analysis is informational only and does not constitute a professional vehicle inspection. Results depend on photo quality, lighting, and angle. Always verify important findings with a qualified mechanic before making a purchase decision.',
  },

  // ── 5 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'bmw-3-series-common-problems',
    metaTitle:       'BMW 3 Series Common Problems | Used Cars Doctor',
    metaDescription: 'Known issues to check before buying a used BMW 3 Series. Covers engine oil consumption, cooling systems, timing chains, electrical faults, and rust by generation.',
    keywords:        'BMW 3 Series common problems, BMW 3 Series issues, used BMW 3 Series, E90 problems, F30 problems',
    h1:              'BMW 3 Series Common Problems to Check Before Buying',
    lead:            'The BMW 3 Series is one of the most popular premium used cars in Europe, spanning generations from the classic E46 through to the current G20. Each generation offers strong driving dynamics and a refined feel, but carries well-documented issues that are worth inspecting carefully before any purchase.',
    sections: [
      {
        heading: 'Engine Oil Consumption',
        body:    'Higher than expected oil consumption is a recurring theme across several 3 Series engine families. The N47 four-cylinder diesel, the N52 and N54 six-cylinder petrols, and the N20 and N55 turbocharged petrols have all been documented consuming oil between services.',
        bullets: [
          'Check the oil level at viewing — a low reading on a car with a recent service is a red flag.',
          'Ask for the last 3–4 service invoices and check whether top-ups were required between full services.',
          'On N47 diesel engines, a clicking sound from the engine bay particularly on cold mornings may indicate chain tensioner wear.',
        ],
      },
      {
        heading: 'Cooling System',
        body:    'BMW cooling systems, particularly on the E46 and E90 generations, are known to develop leaks as plastic expansion tanks and thermostat housings age. Overheating on a BMW can lead to expensive head gasket or engine damage relatively quickly.',
        bullets: [
          'Check the coolant level and condition — a low level without an obvious reason is a concern.',
          'Look for white residue or discolouration around hose connections and the expansion tank.',
          'Ask when the coolant was last changed — BMW recommends every two years on many models.',
        ],
      },
      {
        heading: 'Timing Chain (N47, N20)',
        body:    'The N47 diesel engine used in many 2007–2013 3 Series models has a rear-mounted timing chain with a known history of tensioner failure at higher mileages. The N20 petrol engine used in 2012–2016 F30 models shares similar documented issues with timing chain wear.',
        bullets: [
          'Listen for rattling sounds on cold start — a brief rattle that disappears quickly could indicate a worn tensioner.',
          'Ask for any evidence of timing chain inspection or replacement in the service history.',
          'A pre-purchase inspection by a BMW specialist is strongly recommended for N47 cars above 100,000 miles.',
        ],
      },
      {
        heading: 'Electrical and Electronics',
        body:    'BMW\'s iDrive system and the general complexity of the electrical architecture across E90 and F30 generations generates a variety of fault codes and module failures. Common ones include:',
        bullets: [
          'Window regulator failures — the rear windows are particularly prone on the E90.',
          'Adaptive headlight motors — can fail and trigger a warning light.',
          'Central locking issues and door handle failures on high-mileage examples.',
          'Request a live OBD scan during any inspection to check for stored fault codes beyond what the dash warning lights show.',
        ],
      },
      {
        heading: 'Rust and Bodywork (E46, E90)',
        body:    'Earlier 3 Series, particularly E46 and some early E90 models, can develop rust in the rear wheel arches and along door sills. This is especially common in markets where road salt is used in winter.',
        bullets: [
          'Press firmly on the lower door sills and wheel arch lips — soft or hollow areas indicate corrosion beneath the surface.',
          'Check the boot floor and spare wheel well for signs of damp or rust.',
          'Inspect the front subframe mounting points on E46 models, which are a known rust location.',
        ],
      },
      {
        heading: 'Key Checks Before Buying',
        body:    'For any used 3 Series, prioritise:',
        bullets: [
          'Full BMW service history, ideally from a main dealer or specialist.',
          'An OBD diagnostic scan to reveal fault codes not showing on the dashboard.',
          'Cooling system condition and recent coolant change.',
          'Engine oil level check and consumption enquiry.',
          'Timing chain status on N47 and N20 engines.',
          'A test drive including cold start assessment.',
        ],
      },
    ],
    ctaHeading: 'Inspect a BMW 3 Series Before You Buy',
    ctaBody:    'Used Cars Doctor guides you through a structured BMW inspection, including AI photo analysis for paint and bodywork, and a checklist covering all the areas above.',
    disclaimer: 'Information on known issues is general and based on publicly documented fault patterns. Individual vehicles vary. Always perform a full independent inspection before any purchase.',
  },

  // ── 6 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'audi-a4-common-problems',
    metaTitle:       'Audi A4 Common Problems | Used Cars Doctor',
    metaDescription: 'Known problems to check before buying a used Audi A4. Covers oil consumption, DSG gearbox, timing chain, diesel particulate filters, and electrical issues.',
    keywords:        'Audi A4 common problems, Audi A4 issues, used Audi A4, B8 A4 problems, TFSI oil consumption',
    h1:              'Audi A4 Common Problems to Check Before Buying',
    lead:            'The Audi A4 is a consistently popular used premium saloon, valued for its build quality and refined interior. Whether you are looking at a B7, B8, or B9 generation, each comes with documented issues that a thorough inspection should address.',
    sections: [
      {
        heading: 'Oil Consumption — 1.8T and 2.0 TFSI Engines',
        body:    'The EA113 1.8T and early EA888 2.0 TFSI engines fitted to B6, B7, and early B8 A4 models are well documented for consuming engine oil between services. In some cases this is within Audi\'s published tolerance, but it can mask deeper piston ring wear.',
        bullets: [
          'Check the oil level at the point of viewing — a noticeably low reading on a car that claims recent servicing is a significant red flag.',
          'Ask specifically whether the car has needed oil top-ups between services, and how much.',
          'Later EA888 Generation 3 engines (from approximately 2012 onwards) have largely resolved this issue.',
        ],
      },
      {
        heading: 'DSG and S-Tronic Gearbox',
        body:    'Many A4 variants are fitted with Audi\'s DSG (Direct Shift Gearbox) or S-Tronic dual-clutch transmission. These are generally reliable when serviced correctly, but service intervals are often exceeded by previous owners.',
        bullets: [
          'Check for a documented DSG/S-Tronic fluid and filter change — Audi recommends this every 40,000 miles on a dry-clutch unit (DQ200) and every 40–60,000 miles on a wet-clutch unit (DQ250 and DL501).',
          'During the test drive, pay attention to any judder at low speed, hesitation between 1st and 2nd gear, or jerky engagement from standstill — these are common symptoms of a dry-clutch DQ200 needing service.',
          'Avoid cars with a history of the mechatronic unit being replaced under warranty, unless the cause has been fully documented and resolved.',
        ],
      },
      {
        heading: 'Timing Chain and Tensioner',
        body:    'The 2.0 TFSI engines in B7 and B8 A4 models have a documented history of timing chain tensioner failure, particularly on higher mileage units. A failed tensioner can cause the timing chain to skip, leading to serious engine damage.',
        bullets: [
          'Listen for a brief metallic rattle from the engine on cold start — this often disappears within seconds but indicates tensioner wear.',
          'Ask for evidence of the tensioner being inspected or replaced — a specialist will be able to check this on the car.',
          'Chains and tensioners on the 3.0 TDI V6 are generally more robust but still worth verifying.',
        ],
      },
      {
        heading: 'Diesel Particulate Filter (DPF)',
        body:    'A4 TDI models are fitted with a Diesel Particulate Filter (DPF) which requires periodic regeneration cycles. Cars used predominantly for short urban journeys may suffer DPF blockages.',
        bullets: [
          'Check that no DPF warning light is present and that the car has not had a DPF removal — this is illegal in most European countries for road use.',
          'A DPF replacement on a later A4 can cost between €800–€1,500 at a main dealer.',
          'Ask the seller about typical usage — predominantly short urban runs are a risk factor.',
        ],
      },
      {
        heading: 'Electrical Faults',
        body:    'The B8 and B9 A4 carry a substantial amount of electronics, and faults that do not trigger a dashboard warning light may still be stored in the vehicle\'s control modules.',
        bullets: [
          'An OBD diagnostic scan covering all modules (not just the engine) will often reveal stored fault codes.',
          'MMI (Multi Media Interface) issues, including screen freezes and failure to connect to the CAN bus, are common on higher mileage B8 models.',
          'Faulty door modules causing intermittent window and mirror issues have been reported on multiple generations.',
        ],
      },
      {
        heading: 'Key Checks Before Buying an Audi A4',
        body:    'Regardless of generation, prioritise these checks:',
        bullets: [
          'Full documented service history with oil change dates and mileages.',
          'Oil level check at viewing.',
          'DSG or S-Tronic service history if applicable.',
          'Multi-module OBD scan for stored fault codes.',
          'Cold start assessment for timing chain rattle.',
          'Comprehensive test drive including low-speed DSG behaviour.',
        ],
      },
    ],
    ctaHeading: 'Inspect an Audi A4 With a Guided Checklist',
    ctaBody:    'Used Cars Doctor takes you through a structured Audi A4 inspection on your phone. Photo analysis flags visible bodywork concerns and the guided checklist covers all the areas above.',
    disclaimer: 'Issue descriptions reflect publicly documented fault patterns for these models. Individual vehicles vary significantly. A professional pre-purchase inspection is recommended before any significant purchase.',
  },

  // ── 7 ─────────────────────────────────────────────────────────────────────
  {
    slug:            'vw-golf-common-problems',
    metaTitle:       'VW Golf Common Problems | Used Cars Doctor',
    metaDescription: 'Known issues to check before buying a used VW Golf. Covers DSG gearbox, diesel emissions, timing chain, water pump, and common electrical faults by generation.',
    keywords:        'VW Golf common problems, Volkswagen Golf issues, used VW Golf, Golf 7 problems, Golf DSG problems',
    h1:              'VW Golf Common Problems to Check Before Buying',
    lead:            'The Volkswagen Golf is the best-selling used car in much of Europe, available in more variants, engine options, and trim levels than almost any competitor. Its familiarity and wide service network make ownership generally manageable, but specific generation and engine combinations carry documented issues worth knowing before you buy.',
    sections: [
      {
        heading: 'DSG Gearbox — DQ200 and DQ250',
        body:    'The Golf has been offered with two primary DSG variants: the dry-clutch DQ200 (7-speed) and the wet-clutch DQ250 (6-speed). The DQ200, fitted to lower-powered petrols and diesels, is more prone to low-speed judder and hesitation when the fluid and clutch assembly have not been serviced regularly.',
        bullets: [
          'Check the DSG service history — the DQ200 requires a mechatronic fluid change approximately every 40,000 miles. Many owners skip this.',
          'During the test drive, assess behaviour at parking speeds and during slow-speed manoeuvres. Any judder, clunk, or hesitation from a standing start on a DQ200 warrants further investigation.',
          'The DQ250 wet-clutch unit is generally more forgiving but still requires periodic fluid changes.',
          'Avoid cars where the DSG has been "remapped" without a corresponding service.',
        ],
      },
      {
        heading: 'EA189 Diesel Engines — Emissions Software',
        body:    'Golf models fitted with the 1.6 TDI and 2.0 TDI EA189 engine (2009–2015 approximately) were subject to the widely publicised emissions software issue. Volkswagen issued a mandatory software update and in some cases hardware modifications.',
        bullets: [
          'Check whether the car has received the official VW recall update — this is verifiable via the VIN on Volkswagen\'s own recall portal.',
          'Some cars received the update but subsequently developed higher fuel consumption or occasional EGR-related fault codes.',
          'An OBD scan will confirm whether any emissions-related faults are stored.',
        ],
      },
      {
        heading: '1.4 TSI — Timing Chain and Timing System',
        body:    'The 1.4 TSI engine (EA111 and early EA211 families) fitted to Golf 5 and Golf 6 models has documented timing chain stretch on higher mileage examples, particularly where service intervals have been extended.',
        bullets: [
          'Listen for a brief rattle on cold start from the top of the engine — this is a classic symptom.',
          'Timing chain replacement on a Golf is a significant workshop job — budget accordingly if a specialist flags wear.',
          'The later EA211 1.4 TSI introduced from around 2012 is generally more reliable in this regard.',
        ],
      },
      {
        heading: 'Water Pump and Thermostat (Golf 7 / MK7)',
        body:    'The Golf 7 (2012–2019) introduced the EA211 engine family across most petrol variants. These engines use a plastic thermostat housing integrated with the water pump, which is a known wear item particularly beyond 80,000–100,000 miles.',
        bullets: [
          'Check the coolant level and condition.',
          'A water pump or thermostat replacement on a Golf 7 is a moderate cost job but can cause overheating if neglected.',
          'Look for any recent coolant top-ups in the service record — these can indicate a developing leak.',
        ],
      },
      {
        heading: 'Common Electrical Faults',
        body:    'Across Golf generations, several electrical faults appear regularly:',
        bullets: [
          'Window regulators — particularly the rear windows on Golf 5 and 6, can fail or become slow.',
          'Touchscreen and MIB infotainment issues on Golf 7 — screen freezes, navigation errors, and Bluetooth dropouts.',
          'Parking sensor faults — a common and often cosmetic fault on higher-mileage examples.',
          'Electric parking brake faults on Golf 7 GTD and some higher trims.',
          'An OBD scan across all modules will surface stored fault codes that are not visible on the dashboard.',
        ],
      },
      {
        heading: 'Key Checks Before Buying a VW Golf',
        body:    'For any used Golf, ensure you cover:',
        bullets: [
          'DSG service history — specifically fluid and filter change intervals.',
          'EA189 recall completion check via the VIN.',
          'Cold start assessment for timing chain noise on 1.4 TSI.',
          'Coolant system condition on Golf 7.',
          'Multi-module OBD diagnostic scan.',
          'Test drive covering slow-speed DSG behaviour and higher-speed suspension and steering assessment.',
        ],
      },
    ],
    ctaHeading: 'Inspect a VW Golf Before You Buy',
    ctaBody:    'Used Cars Doctor walks you through a complete Golf inspection — guided checklist, AI photo analysis for bodywork, and a confidence report covering all the key areas above.',
    disclaimer: 'Information on common issues is general in nature and based on publicly documented fault patterns. Individual vehicle history, maintenance, and condition vary. A professional pre-purchase inspection is recommended before any purchase.',
  },

]

// ─── Lookup helpers ───────────────────────────────────────────────────────────

const PAGE_MAP = new Map(PAGES.map(p => [p.slug, p]))

export function getSeoPage(slug: string): SeoPageData | undefined {
  return PAGE_MAP.get(slug)
}

export function getAllSeoSlugs(): string[] {
  return PAGES.map(p => p.slug)
}
