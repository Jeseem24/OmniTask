import { NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/prisma';
import { calculatePriorityScore } from '@/lib/priorityEngine';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();

    const { id } = await params;
    const body = await req.json();

    const existingTask = await prisma.task.findUnique({
      where: { id },
    });

    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const updateData: any = {};

    if (body.status !== undefined) {
      updateData.status = body.status;
      if (body.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else {
        updateData.completedAt = null;
      }
    }

    if (body.title !== undefined) updateData.title = body.title;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.subjectId !== undefined) updateData.subjectId = body.subjectId;
    if (body.taskType !== undefined) updateData.taskType = body.taskType;
    if (body.importance !== undefined) updateData.importance = body.importance;
    if (body.estimatedEffortMins !== undefined) updateData.estimatedEffortMins = body.estimatedEffortMins;

    if (body.deadlineISO !== undefined) {
      updateData.deadline = body.deadlineISO ? new Date(body.deadlineISO) : null;
    }

    // Recalculate Priority Score if fields changed
    const newDeadline = updateData.deadline !== undefined ? updateData.deadline : existingTask.deadline;
    const newImportance = updateData.importance !== undefined ? updateData.importance : existingTask.importance;
    const newTaskType = updateData.taskType !== undefined ? updateData.taskType : existingTask.taskType;
    const newEffort = updateData.estimatedEffortMins !== undefined ? updateData.estimatedEffortMins : existingTask.estimatedEffortMins;

    updateData.priorityScore = calculatePriorityScore({
      deadline: newDeadline,
      importance: newImportance,
      taskType: newTaskType,
      estimatedEffortMins: newEffort,
      userModified: true,
    });
    updateData.userModified = true;

    const updatedTask = await prisma.task.update({
      where: { id },
      data: updateData,
      include: {
        subject: true,
        subtasks: true,
      },
    });

    return NextResponse.json(updatedTask);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await ensureDbInitialized();

    const { id } = await params;
    await prisma.task.delete({
      where: { id },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting task:', error);
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
