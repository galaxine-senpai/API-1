import {
  RequestWithSearchParameters,
} from '@src/middleware/validators/validateSearchParameters';
import { Response } from 'express';
import { ExploreDB } from '@src/util/Database/ExploreDB';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import { ResRoadmap } from '@src/types/response/ResRoadmap';

function responseSearchRoadmaps(
  res: Response,
  roadmaps: ResRoadmap[],
  total: bigint,
): unknown {
  return res.status(HttpStatusCodes.OK).json({
    success: true,
    message: `Roadmaps ${roadmaps.length ? '' : 'not '}found`,
    data: roadmaps,
    total: total,
  });
}

export async function searchRoadmaps(
  req: RequestWithSearchParameters,
  res: Response,
): Promise<unknown> {
  const db = new ExploreDB();

  const roadmaps = await db.getRoadmaps(req, req.session?.userId);

  return responseSearchRoadmaps(
    res,
    roadmaps,
    roadmaps[0]?.totalRoadmaps || 0n,
  );
}
