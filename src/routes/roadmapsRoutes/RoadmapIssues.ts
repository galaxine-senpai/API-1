import { Router } from 'express';
import Paths from '@src/constants/Paths';
import { RequestWithSession } from '@src/middleware/session';
import { Issue } from '@src/types/models/Issue';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import Database from '@src/util/DatabaseDriver';
import { Roadmap } from '@src/types/models/Roadmap';
import IssuesUpdate from '@src/routes/roadmapsRoutes/issuesRoutes/IssuesUpdate';
import Comments from '@src/routes/roadmapsRoutes/issuesRoutes/CommentsRouter';
import validateSession from '@src/middleware/validators/validateSession';

const RoadmapIssues = Router({ mergeParams: true });

RoadmapIssues.post(Paths.Roadmaps.Issues.Create, validateSession);
RoadmapIssues.post(
  Paths.Roadmaps.Issues.Create,
  async (req: RequestWithSession, res) => {
    //get data from body and session
    let issue: Issue;
    const session = req.session;

    try {
      // eslint-disable-next-line max-len
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-member-access
      const issueData = req.body?.issue as Issue;

      if (!issueData || !Issue.isIssue(issueData)) {
        throw new Error('Issue is missing.');
      }

      issue = new Issue(issueData);

      // set userId
      issueData.set({
        userId: session?.userId,
        id: -1n,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch (e) {
      return res
        .status(HttpStatusCodes.BAD_REQUEST)
        .json({ error: 'Issue data is invalid.' });
    }

    // get database connection
    const db = new Database();

    // save issue to database
    const id = await db.insert('issues', issue);

    // check if id is valid
    if (id < 0)
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Issue could not be saved to database.' });

    // return id
    return res.status(HttpStatusCodes.CREATED).json({ id: id.toString() });
  },
);

RoadmapIssues.get(Paths.Roadmaps.Issues.Get, async (req, res) => {
  // get issue id  from params
  const issueId = BigInt(req.params?.issueId || -1);
  const roadmapId = BigInt(req.params?.roadmapId || -1);

  // get database connection
  const db = new Database();

  if (roadmapId < 0)
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ error: 'Roadmap id is invalid.' });

  // get roadmap from database
  const roadmap = await db.get('roadmaps', roadmapId);

  // check if roadmap exists
  if (!roadmap)
    return res
      .status(HttpStatusCodes.NOT_FOUND)
      .json({ error: 'Roadmap not found.' });

  // check if issue id is valid
  if (issueId < 0)
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ error: 'Issue id is invalid.' });
  // get issue from database
  const issue = await db.get<Issue>('issues', issueId);

  // check if issue exists
  if (!issue)
    return res
      .status(HttpStatusCodes.NOT_FOUND)
      .json({ error: 'Issue not found.' });

  // return issue
  return res.status(HttpStatusCodes.OK).json({
    issue: {
      id: issue.id.toString(),
      title: issue.title,
      content: issue.content,
      open: issue.open,
      roadmapId: issue.roadmapId.toString(),
      userId: issue.userId.toString(),
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
    },
  });
});

RoadmapIssues.get(Paths.Roadmaps.Issues.GetAll, async (req, res) => {
  // get issue id  from params
  const roadmapId = BigInt(req.params?.roadmapId || -1);

  const db = new Database();

  if (roadmapId < 0)
    return res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ error: 'Roadmap id is invalid.' });

  // get roadmap from database
  const roadmap = await db.get('roadmaps', roadmapId);

  // check if roadmap exists
  if (!roadmap)
    return res
      .status(HttpStatusCodes.NOT_FOUND)
      .json({ error: 'Roadmap not found.' });

  // check if issue id is valid
  let issues = await db.getAllWhere<Issue>('issues', 'roadmapId', roadmapId);

  if (!issues) issues = [];

  const result = issues
    .filter((issue) => issue.roadmapId === roadmapId)
    .map((issue) => {
      return {
        id: issue.id.toString(),
        title: issue.title,
        content: issue.content,
        roadmapId: issue.roadmapId.toString(),
        userId: issue.userId.toString(),
        open: Boolean(issue.open),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
      };
    });

  // return issues
  return res.status(HttpStatusCodes.OK).json({ issues: result });
});

RoadmapIssues.post(Paths.Roadmaps.Issues.Update.Base, validateSession);
RoadmapIssues.use(Paths.Roadmaps.Issues.Update.Base, IssuesUpdate);

// Delete Issue
RoadmapIssues.delete(Paths.Roadmaps.Issues.Delete, validateSession);
RoadmapIssues.delete(
  Paths.Roadmaps.Issues.Delete,
  async (req: RequestWithSession, res) => {
    // get data from body and session
    const session = req.session;
    const id = BigInt(req.params.issueId);

    // get database connection
    const db = new Database();

    // get issue from the database
    const issue = await db.get<Issue>('issues', id);

    // check if issue exists
    if (!issue)
      return res
        .status(HttpStatusCodes.NOT_FOUND)
        .json({ error: 'Issue not found.' });

    const roadmap = await db.get<Roadmap>('roadmaps', issue.roadmapId);

    // check if roadmap exists
    if (!roadmap)
      return res
        .status(HttpStatusCodes.NOT_FOUND)
        .json({ error: 'Roadmap not found.' });

    // check if userDisplay is owner
    if (issue.userId !== session?.userId && roadmap.userId !== session?.userId)
      return res
        .status(HttpStatusCodes.FORBIDDEN)
        .json({ error: 'User is not owner of issue or roadmap.' });

    // delete issue from database
    const success = await db.delete('issues', id);

    // check if issue was deleted
    if (!success)
      return res
        .status(HttpStatusCodes.INTERNAL_SERVER_ERROR)
        .json({ error: 'Issue could not be deleted.' });

    // return success
    return res.status(HttpStatusCodes.OK).json({ success: true });
  },
);

RoadmapIssues.use(Paths.Roadmaps.Issues.Comments.Base, Comments);

export default RoadmapIssues;
