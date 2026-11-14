// Biblioteca de exercícios de musculação por grupo muscular
import type { MuscleGroup } from '@/store/types';

export interface Exercise {
  id: string;
  name: string;
  group: MuscleGroup;
  custom?: boolean;
}

export const MUSCLE_GROUPS: Array<{ id: MuscleGroup; label: string }> = [
  { id: 'peito', label: 'Peito' },
  { id: 'costas', label: 'Costas' },
  { id: 'pernas', label: 'Pernas' },
  { id: 'ombros', label: 'Ombros' },
  { id: 'biceps', label: 'Bíceps' },
  { id: 'triceps', label: 'Tríceps' },
  { id: 'abdomen', label: 'Abdômen' },
];

const raw: Record<MuscleGroup, string[]> = {
  peito: [
    'Supino reto com barra', 'Supino reto com halteres', 'Supino inclinado com barra', 'Supino inclinado com halteres',
    'Supino declinado', 'Crucifixo com halteres', 'Crucifixo na máquina (peck deck)', 'Crossover na polia',
    'Flexão de braço', 'Supino na máquina', 'Pullover com halter', 'Paralelas (peito)',
  ],
  costas: [
    'Puxada frontal (pulldown)', 'Puxada com triângulo', 'Barra fixa', 'Remada curvada com barra', 'Remada unilateral com halter',
    'Remada baixa na polia', 'Remada cavalinho (T-bar)', 'Remada na máquina', 'Levantamento terra', 'Pulldown com corda',
    'Hiperextensão lombar', 'Encolhimento com halteres',
  ],
  pernas: [
    'Agachamento livre', 'Agachamento no Smith', 'Leg press 45°', 'Cadeira extensora', 'Mesa flexora', 'Cadeira flexora',
    'Stiff', 'Levantamento terra romeno', 'Afundo / passada', 'Agachamento búlgaro', 'Hack machine', 'Cadeira abdutora',
    'Cadeira adutora', 'Elevação pélvica (hip thrust)', 'Panturrilha em pé', 'Panturrilha sentado', 'Glúteo na polia',
    'Agachamento sumô', 'Avanço com halteres',
  ],
  ombros: [
    'Desenvolvimento com halteres', 'Desenvolvimento com barra', 'Desenvolvimento na máquina', 'Elevação lateral',
    'Elevação lateral na polia', 'Elevação frontal', 'Crucifixo invertido', 'Face pull', 'Remada alta', 'Arnold press',
  ],
  biceps: [
    'Rosca direta com barra', 'Rosca direta com barra W', 'Rosca alternada com halteres', 'Rosca martelo', 'Rosca concentrada',
    'Rosca Scott', 'Rosca na polia', 'Rosca inclinada com halteres',
  ],
  triceps: [
    'Tríceps na polia (barra)', 'Tríceps corda', 'Tríceps testa', 'Tríceps francês', 'Mergulho no banco',
    'Paralelas (tríceps)', 'Tríceps coice', 'Supino fechado',
  ],
  abdomen: [
    'Abdominal supra', 'Abdominal infra', 'Prancha', 'Prancha lateral', 'Abdominal na polia', 'Elevação de pernas',
    'Abdominal oblíquo', 'Abdominal bicicleta', 'Roda abdominal', 'Abdominal remador',
  ],
};

const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const EXERCISES: Exercise[] = (Object.keys(raw) as MuscleGroup[]).flatMap((group) =>
  raw[group].map((name) => ({ id: slug(name), name, group })),
);

export const groupLabel = (g: MuscleGroup) => MUSCLE_GROUPS.find((m) => m.id === g)?.label ?? g;
