import { NextResponse } from 'next/server';
import { prisma, ensureDbInitialized } from '@/lib/prisma';
import { calculatePriorityScore } from '@/lib/priorityEngine';

export async function GET(req: Request) {
  try {
    await ensureDbInitialized();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const subjectId = searchParams.get('subjectId');
    const taskType = searchParams.get('taskType');
    const availableMins = searchParams.get('availableMins');

    const whereClause: any = {
      parentTaskId: null,
    };

    if (status && status !== 'all') {
      whereClause.status = status;
    }

    if (subjectId) {
      whereClause.subjectId = subjectId;
    }

    if (taskType) {
      whereClause.taskType = taskType;
    }

    if (availableMins) {
      const mins = parseInt(availableMins, 10);
      if (!isNaN(mins)) {
        whereClause.estimatedEffortMins = { lte: mins };
      }
    }

    const tasks = await prisma.task.findMany({
      where: whereClause,
      include: {
        subject: true,
        subtasks: {
          orderBy: { createdAt: 'asc' },
        },
        source: true,
      },
      orderBy: [
        { status: 'desc' }, // 'PENDING' before 'COMPLETED'
        { priorityScore: 'desc' },
        { deadline: 'asc' },
      ],
    });

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return NextResponse.json([]);
  }
}

export async function POST(req: Request) {
  try {
    await ensureDbInitialized();

    const body = await req.json();
    const { title, description, subjectId, taskType, deadlineISO, importance, estimatedEffortMins } = body;

    if (!title) {
      return NextResponse.json({ error: 'Task title is required' }, { status: 400 });
    }

    const deadlineDate = deadlineISO ? new Date(deadlineISO) : null;
    const priorityScore = calculatePriorityScore({
      deadline: deadlineDate,
      importance: importance || 3,
      taskType: taskType || 'ASSIGNMENT',
      estimatedEffortMins: estimatedEffortMins || 30,
    });

    const newTask = await prisma.task.create({
      data: {
        title,
        description: description || null,
        subjectId: subjectId || null,
        taskType: taskType || 'ASSIGNMENT',
        status: 'PENDING',
        priorityScore,
        importance: importance || 3,
        deadline: deadlineDate,
        estimatedEffortMins: estimatedEffortMins || 30,
        userModified: true,
      },
      include: {
        subject: true,
        subtasks: true,
      },
    });

    return NextResponse.json(newTask, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureDbInitialized();
    const { searchParams } = new URL(req.url);
    const scope = searchParams.get('scope') || 'all';

    if (scope === 'completed') {
      await prisma.task.deleteMany({
        where: { status: 'COMPLETED' },
      });
    } else {
      await prisma.task.deleteMany({});
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing tasks:', error);
    return NextResponse.json({ error: error.message || 'Failed to clear tasks' }, { status: 500 });
  }
}
