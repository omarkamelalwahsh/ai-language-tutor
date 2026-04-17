import { CefrLevel, SkillName } from '../types/assessment';

export interface CefrDescriptor {
  id: string;
  skill: SkillName;
  level: CefrLevel;
  canonicalTextEn: string;
  localizedTextAr: string;
}

/**
 * A localized, refined internal CEFR descriptor catalog.
 * Every assessment claim must trace back to one of these descriptors.
 */
export const CEFR_CATALOG: CefrDescriptor[] = [
  // --- LISTENING ---
  {
    id: 'listen_a1_1',
    skill: 'listening',
    level: 'A1',
    canonicalTextEn: 'Can understand very short, simple phrases when people speak slowly.',
    localizedTextAr: 'يمكنه فهم العبارات القصيرة والبسيطة للغاية عندما يتحدث الناس ببطء.',
  },
  {
    id: 'listen_a2_1',
    skill: 'listening',
    level: 'A2',
    canonicalTextEn: 'Can understand short, clear everyday messages and announcements.',
    localizedTextAr: 'يمكنه فهم الرسائل والإعلانات اليومية القصيرة والواضحة.',
  },
  {
    id: 'listen_b1_1',
    skill: 'listening',
    level: 'B1',
    canonicalTextEn: 'Can understand the main points of clear standard speech on familiar matters.',
    localizedTextAr: 'يمكنه فهم النقاط الرئيسية للكلام المعياري الواضح حول مواضيع مألوفة.',
  },
  {
    id: 'listen_b2_1',
    skill: 'listening',
    level: 'B2',
    canonicalTextEn: 'Can understand standard spoken language, live or broadcast, on both familiar and unfamiliar topics.',
    localizedTextAr: 'يمكنه فهم اللغة المنطوقة المعيارية، سواء كانت حية أو مذاعة، حول مواضيع مألوفة وغير مألوفة.',
  },
  {
    id: 'listen_c1_1',
    skill: 'listening',
    level: 'C1',
    canonicalTextEn: 'Can follow extended speech even when it is not clearly structured.',
    localizedTextAr: 'يمكنه متابعة الكلام الطويل حتى عندما لا يكون منظمًا بشكل واضح.',
  },
  {
    id: 'listen_c2_1',
    skill: 'listening',
    level: 'C2',
    canonicalTextEn: 'Has no difficulty understanding any kind of spoken language, even at fast native speed.',
    localizedTextAr: 'ليس لديه صعوبة في فهم أي نوع من اللغة المنطوقة، حتى بسرعة المتحدثين الأصليين.',
  },

  // --- SPEAKING ---
  {
    id: 'speak_a1_1',
    skill: 'speaking',
    level: 'A1',
    canonicalTextEn: 'Can use simple phrases to describe where they live and people they know.',
    localizedTextAr: 'يمكنه استخدام عبارات بسيطة لوصف مكان سكنه والأشخاص الذين يعرفهم.',
  },
  {
    id: 'speak_a2_1',
    skill: 'speaking',
    level: 'A2',
    canonicalTextEn: 'Can describe routine activities and immediate surroundings using simple language.',
    localizedTextAr: 'يمكنه وصف الأنشطة الروتينية والبيئة المحيطة المباشرة باستخدام لغة بسيطة.',
  },
  {
    id: 'speak_b1_1',
    skill: 'speaking',
    level: 'B1',
    canonicalTextEn: 'Can express thoughts on more abstract, cultural topics such as films, books, or music.',
    localizedTextAr: 'يمكنه التعبير عن أفكاره حول مواضيع أكثر تجريدًا وثقافية مثل الأفلام أو الكتب أو الموسيقى.',
  },
  {
    id: 'speak_b2_1',
    skill: 'speaking',
    level: 'B2',
    canonicalTextEn: 'Can give clear, detailed descriptions on a wide range of subjects related to their field of interest.',
    localizedTextAr: 'يمكنه تقديم أوصاف واضحة ومفصلة حول مجموعة واسعة من المواضيع المتعلقة بمجال اهتمامه.',
  },

  // --- WRITING ---
  {
    id: 'write_a1_1',
    skill: 'writing',
    level: 'A1',
    canonicalTextEn: 'Can write a short, simple postcard, for example sending holiday greetings.',
    localizedTextAr: 'يمكنه كتابة بطاقة بريدية قصيرة وبسيطة، على سبيل المثال إرسال تحيات العطلة.',
  },
  {
    id: 'write_b1_1',
    skill: 'writing',
    level: 'B1',
    canonicalTextEn: 'Can write simple connected text on topics which are familiar or of personal interest.',
    localizedTextAr: 'يمكنه كتابة نص بسيط ومترابط حول مواضيع مألوفة أو ذات اهتمام شخصي.',
  },

  // --- GRAMMAR (STRUCTURAL CAPS) ---
  {
    id: 'grammar_a2_1',
    skill: 'grammar',
    level: 'A2',
    canonicalTextEn: 'Uses some simple structures correctly, but still systematically makes basic errors.',
    localizedTextAr: 'يستخدم بعض التراكيب البسيطة بشكل صحيح، لكنه لا يزال يرتكب أخطاء أساسية بشكل منهجي.',
  },
  {
    id: 'grammar_b1_1',
    skill: 'grammar',
    level: 'B1',
    canonicalTextEn: 'Communicates with reasonable accuracy in familiar contexts; generally good control though with noticeable mother tongue influence.',
    localizedTextAr: 'يتواصل بدقة معقولة في السياقات المألوفة؛ سيطرة جيدة بشكل عام رغم وجود تأثير ملحوظ للغة الأم.',
  }
];

export function getDescriptorById(id: string): CefrDescriptor | undefined {
  return CEFR_CATALOG.find(d => d.id === id);
}

export function getDescriptorsBySkillAndLevel(skill: SkillName, level: CefrLevel): CefrDescriptor[] {
  return CEFR_CATALOG.filter(d => d.skill === skill && d.level === level);
}
