import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Delete user's personal learning progress data
    const progressRecords = await base44.asServiceRole.entities.LearningProgress.filter({ created_by_id: user.id });
    for (const record of progressRecords) {
      await base44.asServiceRole.entities.LearningProgress.delete(record.id);
    }

    // Delete the user account
    await base44.asServiceRole.entities.User.delete(user.id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}