import { Accessibility, BrainCircuit, Microscope, ScanLine, Stethoscope, Workflow } from "lucide-react";

export const THEME_TOPICS = [
  {
    title: "Artificial intelligence in healthcare",
    icon: BrainCircuit,
    short: "Machine learning that supports, not supplants, clinical expertise.",
    detail:
      "From triage to imaging, AI tools are entering clinical pathways. The key questions are about validation, bias, transparency and accountability: how do we know a model works for the patients in front of us?",
  },
  {
    title: "Digital diagnostics and clinical decision-making",
    icon: ScanLine,
    short: "Data-driven tools that sharpen diagnosis and judgement.",
    detail:
      "Decision support, remote monitoring and digital diagnostics can surface information earlier. Their value depends on how they fit real workflows and whether outcomes genuinely improve.",
  },
  {
    title: "Surgical technology and simulation",
    icon: Stethoscope,
    short: "New ways to learn, rehearse and perform procedures.",
    detail:
      "Simulation and emerging surgical technology are changing how skills are taught and assessed. Understanding their evidence base matters as much as the technology itself.",
  },
  {
    title: "Evidence-based digital interventions",
    icon: Microscope,
    short: "Holding digital health to the same standard as any treatment.",
    detail:
      "Apps, platforms and digital therapeutics need rigorous evaluation. Trial design, outcome selection and real-world evidence all shape whether an innovation should be adopted.",
  },
  {
    title: "Accessibility and digital health inequalities",
    icon: Accessibility,
    short: "Making sure innovation reaches everyone who needs it.",
    detail:
      "Connectivity, digital literacy, language, disability and cost all affect who benefits. Without deliberate design, digital health can widen the gaps it aims to close.",
  },
  {
    title: "Translating innovation into clinical practice",
    icon: Workflow,
    short: "The long road from prototype to patient benefit.",
    detail:
      "Implementation science, regulation, procurement and clinician adoption determine whether a promising tool ever changes care. Evidence is the bridge.",
  },
];
