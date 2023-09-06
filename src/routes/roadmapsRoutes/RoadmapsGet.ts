import { Response, Router } from 'express';
import Paths from '@src/constants/Paths';
import { RequestWithSession } from '@src/middleware/session';
import HttpStatusCodes from '@src/constants/HttpStatusCodes';
import Database from '@src/util/Database/DatabaseDriver';
import { Roadmap } from '@src/types/models/Roadmap';
import axios from 'axios';
import EnvVars from '@src/constants/EnvVars';
import logger from 'jet-logger';
import { IUser } from '@src/types/models/User';
import { RoadmapView } from '@src/types/models/RoadmapView';

const RoadmapsGet = Router({ mergeParams: true });

async function checkIfRoadmapExists(
  req: RequestWithSession,
  res: Response,
): Promise<
  | {
      id: bigint;
      roadmap: Roadmap;
      issueCount: bigint;
      likes: bigint;
      isLiked: boolean;
    }
  | undefined
> {
  const id = req.params.roadmapId;

  if (!id) {
    res
      .status(HttpStatusCodes.BAD_REQUEST)
      .json({ error: 'Roadmap id is missing.' });
    return;
  }

  // get database connection
  const db = new Database();

  // get roadmap from database
  const roadmap = await db.get<Roadmap>('roadmaps', BigInt(id));
  const issueCount = await db.countWhere('issues', 'roadmapId', id);

  // check if roadmap is valid
  if (!roadmap) {
    res
      .status(HttpStatusCodes.NOT_FOUND)
      .json({ error: 'Roadmap does not exist.' });

    return;
  }

  // get likes where roadmapId = id
  const likes = await new Database().countWhere(
    'roadmapLikes',
    'roadmapId',
    id,
  );

  let isLiked = false;

  if (req.session) {
    const liked = await new Database().getAllWhere<{
      roadmapId: bigint;
      userId: bigint;
    }>('roadmapLikes', 'userId', req.session.userId);

    if (liked) {
      if (liked.some((like) => like.roadmapId === BigInt(id))) {
        isLiked = true;
      }
    }
  }

  return { id: BigInt(id), roadmap, issueCount, likes, isLiked };
}

export async function addView(
  userId: bigint,
  roadmapId: bigint,
  full: boolean,
): Promise<void> {
  // get database connection
  const db = new Database();

  // get roadmap from database
  const roadmap = await db.get<Roadmap>('roadmaps', roadmapId);

  // check if roadmap is valid
  if (!roadmap) return;

  const view = new RoadmapView({ userId, roadmapId, full });

  await db.insert('roadmapViews', view);
}

RoadmapsGet.get(
  Paths.Roadmaps.Get.Roadmap,
  async (req: RequestWithSession, res) => {
    //get data from params
    const data = await checkIfRoadmapExists(req, res);

    if (!data) return;

    const { roadmap, issueCount, likes, isLiked } = data;

    // add view
    await addView(req.session?.userId || BigInt(-1), roadmap.id, true);

    // return roadmap
    return res.status(HttpStatusCodes.OK).json({
      id: roadmap.id.toString(),
      name: roadmap.name,
      description: roadmap.description,
      ownerId: roadmap.userId.toString(),
      issueCount: issueCount.toString(),
      likes: likes.toString(),
      isLiked,
      createdAt: roadmap.createdAt,
      updatedAt: roadmap.updatedAt,
      isPublic: roadmap.isPublic,
      data: roadmap.data,
    });
  },
);

RoadmapsGet.get(
  Paths.Roadmaps.Get.MiniRoadmap,
  async (req: RequestWithSession, res) => {
    // get id from params
    const data = await checkIfRoadmapExists(req, res);

    if (!data) return;

    let user = await new Database().get<IUser>('users', data.roadmap.userId);
    if (!user) {
      user = { id: -1n } as IUser;
    }

    const { roadmap, likes, isLiked } = data;

    // add view
    await addView(req.session?.userId || BigInt(-1), roadmap.id, false);

    // return roadmap
    return res.status(HttpStatusCodes.OK).json({
      id: roadmap.id.toString(),
      name: roadmap.name,
      description: roadmap.description,
      likes: likes.toString(),
      isLiked,
      ownerName: user.name,
      ownerId: roadmap.userId.toString(),
    });
  },
);

RoadmapsGet.get(
  Paths.Roadmaps.Get.Owner,
  async (req: RequestWithSession, res) => {
    //get data from params
    const data = await checkIfRoadmapExists(req, res);

    if (!data) return;

    const { roadmap } = data;

    // fetch /api/users/:id
    axios
      .get(`http://localhost:${EnvVars.Port}/api/users/${roadmap.userId}`)
      .then((response) => {
        res.status(response.status).json(response.data);
      })
      .catch((error) => {
        logger.err(error);
        res.status(500).send('An error occurred');
      });
  },
);

RoadmapsGet.get(
  Paths.Roadmaps.Get.OwnerMini,
  async (req: RequestWithSession, res) => {
    //get data from params
    const data = await checkIfRoadmapExists(req, res);

    if (!data) return;

    const { roadmap } = data;

    // fetch /api-wrapper/users/:id
    const user = await axios.get(
      `http://localhost:${EnvVars.Port}/api/users/${roadmap.userId}/mini`,
    );

    // ? might need to check if json needs to be parsed

    // return roadmap
    return res.status(user.status).json(user.data);
  },
);

export default RoadmapsGet;
