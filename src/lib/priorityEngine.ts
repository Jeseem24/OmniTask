export interface TaskPriorityInputs {
  deadline?: Date | string | null;
  importance: number; // 1 to 5
  taskType: string;
  estimatedEffortMins: number;
  subtaskCount?: number;
  userModified?: boolean;
}

export function calculatePriorityScore(inputs: TaskPriorityInputs): number {
  // If user MANUALLY changed/overrode priority in UI, strictly enforce manual tier
  if (inputs.userModified && inputs.importance) {
    if (inputs.importance >= 5) return 130; // Critical
    if (inputs.importance === 4) return 90;  // High
    if (inputs.importance === 3) return 55;  // Medium
    if (inputs.importance <= 2) return 20;  // Low
  }

  let score = 0;

  // 1. Urgency Score (Proximity to Deadline)
  if (inputs.deadline) {
    const deadlineDate = new Date(inputs.deadline);
    const now = new Date();
    const hoursRemaining = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursRemaining <= 0) {
      score += 120; // Overdue
    } else if (hoursRemaining <= 12) {
      score += 100;
    } else if (hoursRemaining <= 24) {
      score += 85;
    } else if (hoursRemaining <= 48) {
      score += 65;
    } else if (hoursRemaining <= 72) {
      score += 45;
    } else if (hoursRemaining <= 168) {
      score += 25;
    } else {
      score += 10;
    }
  } else {
    score += 5;
  }

  // 2. Importance Weight (1-5 scale => 15 to 75 points)
  const importanceWeight = Math.max(1, Math.min(5, inputs.importance || 3));
  score += importanceWeight * 15;

  // 3. Task Type Weight
  const typeWeights: Record<string, number> = {
    FINANCE: 40, // Bills, taxes, payments
    EXAM: 40,
    WORK: 35,
    QUIZ: 35,
    PROJECT: 35,
    HEALTH: 30, // Appointments, medication, urgent health
    RECORD: 30,
    SUBMISSION: 25,
    PRESENTATION: 25,
    ASSIGNMENT: 20,
    ERRAND: 20,
    MAINTENANCE: 15,
    PRACTICE: 15,
    READING: 10,
    EVENT: 10,
    PERSONAL: 10,
    OTHER: 5,
  };
  const typeWeight = typeWeights[inputs.taskType?.toUpperCase()] || 15;
  score += typeWeight;

  // 4. Subtasks bonus
  if (inputs.subtaskCount && inputs.subtaskCount > 0) {
    score += Math.min(inputs.subtaskCount * 5, 20);
  }

  return Math.round(score * 10) / 10;
}

export function getPriorityTier(score: number): {
  label: 'Critical' | 'High' | 'Medium' | 'Low';
  colorClass: string;
  bgClass: string;
} {
  if (score >= 120) {
    return { label: 'Critical', colorClass: 'text-red-400', bgClass: 'bg-red-500/10 border-red-500/20' };
  } else if (score >= 80) {
    return { label: 'High', colorClass: 'text-amber-400', bgClass: 'bg-amber-500/10 border-amber-500/20' };
  } else if (score >= 45) {
    return { label: 'Medium', colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500/10 border-emerald-500/20' };
  } else {
    return { label: 'Low', colorClass: 'text-zinc-400', bgClass: 'bg-zinc-500/10 border-zinc-500/20' };
  }
}
