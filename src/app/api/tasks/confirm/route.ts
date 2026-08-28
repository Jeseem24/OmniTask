import { NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/prisma';
import { calculatePriorityScore } from '@/lib/priorityEngine';

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();

    const body = await req.json();
    let tasksToConfirm: any[] = [];

    if (Array.isArray(body.confirmedTasks)) {
      tasksToConfirm = body.confirmedTasks;
    } else if (body && typeof body === 'object' && body.title) {
      tasksToConfirm = [body];
    } else if (Array.isArray(body)) {
      tasksToConfirm = body;
    }

    if (tasksToConfirm.length === 0) {
      return NextResponse.json({ error: 'No confirmed tasks provided' }, { status: 400 });
    }

    const { extractionId, sourceId } = body;
    const createdTasks = [];

    for (const taskData of tasksToConfirm) {
      // Find or create subject if specified by name/code
      let subjectId: string | null = taskData.subjectId || null;
      if (!subjectId && (taskData.subjectName || taskData.subjectCode)) {
        const existingSubject = await prisma.subject.findFirst({
          where: {
            OR: [
              { name: { equals: taskData.subjectName } },
              { code: { equals: taskData.subjectCode } },
            ],
          },
        });

        if (existingSubject) {
          subjectId = existingSubject.id;
        } else if (taskData.subjectName) {
          const newSub = await prisma.subject.create({
            data: {
              name: taskData.subjectName,
              code: taskData.subjectCode || null,
            },
          });
          subjectId = newSub.id;
        }
      }

      // Calculate Priority Score
      const deadlineDate = taskData.deadlineISO ? new Date(taskData.deadlineISO) : null;
      const priorityScore = calculatePriorityScore({
        deadline: deadlineDate,
        importance: taskData.importance || 3,
        taskType: taskData.taskType || 'ASSIGNMENT',
        estimatedEffortMins: taskData.estimatedEffortMins || 30,
        subtaskCount: taskData.subtasks?.length || 0,
        userModified: !!taskData.userModified,
      });

      // Create Parent Task
      const parentTask = await prisma.task.create({
        data: {
          sourceId: sourceId || null,
          subjectId,
          title: taskData.title,
          description: taskData.description || null,
          taskType: taskData.taskType || 'ASSIGNMENT',
          status: 'PENDING',
          priorityScore,
          importance: taskData.importance || 3,
          deadline: deadlineDate,
          isDeadlineAmbiguous: !!taskData.isDeadlineAmbiguous,
          estimatedEffortMins: taskData.estimatedEffortMins || 30,
          aiConfidence: taskData.confidenceScore ?? 1.0,
          userModified: !!taskData.userModified,
        },
      });

      // Create Subtasks if any
      if (Array.isArray(taskData.subtasks) && taskData.subtasks.length > 0) {
        for (const sub of taskData.subtasks) {
          const subTitle = typeof sub === 'string' ? sub : sub?.title || 'Subtask';
          const subTaskType = typeof sub === 'object' && sub?.taskType ? sub.taskType : 'SUBMISSION';
          const subEffort = typeof sub === 'object' && sub?.estimatedEffortMins ? sub.estimatedEffortMins : 15;

          const subPriority = calculatePriorityScore({
            deadline: deadlineDate,
            importance: taskData.importance || 3,
            taskType: subTaskType,
            estimatedEffortMins: subEffort,
          });

          await prisma.task.create({
            data: {
              sourceId: sourceId || null,
              parentTaskId: parentTask.id,
              subjectId,
              title: subTitle,
              taskType: subTaskType,
              status: 'PENDING',
              priorityScore: subPriority,
              importance: taskData.importance || 3,
              deadline: deadlineDate,
              estimatedEffortMins: subEffort,
            },
          });
        }
      }

      createdTasks.push(parentTask);
    }

    // Update extraction status
    if (extractionId) {
      await prisma.candidateExtraction.update({
        where: { id: extractionId },
        data: { status: 'APPROVED' },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, count: createdTasks.length, createdTasks });
  } catch (error: any) {
    console.error('Error confirming candidate tasks:', error);
    return NextResponse.json({ error: error.message || 'Failed to confirm tasks' }, { status: 500 });
  }
}
