import Paths from '@src/constants/Paths';
import { Router } from 'express';
import GetRouter from '@src/routes/roadmapsRoutes/RoadmapsGet';
import UpdateRouter from '@src/routes/roadmapsRoutes/RoadmapsUpdate';
import validateSession from '@src/middleware/validators/validateSession';
import {
  createRoadmap,
  deleteRoadmap,
  dislikeRoadmap,
  likeRoadmap,
  removeLikeRoadmap,
} from '@src/controllers/roadmapController';
import validateBody from '@src/middleware/validators/validateBody';

const RoadmapsRouter = Router();

RoadmapsRouter.post(
  Paths.Roadmaps.Create,
  validateSession,
  validateBody(
    'name',
    'description',
    'data',
    'isPublic',
    'isDraft',
    'version',
    'miscData',
  ),
  createRoadmap,
);

RoadmapsRouter.use(Paths.Roadmaps.Get.Base, GetRouter);
RoadmapsRouter.use(Paths.Roadmaps.Update.Base, UpdateRouter);

RoadmapsRouter.delete(Paths.Roadmaps.Delete, validateSession, deleteRoadmap);

/*
 ! like roadmaps
 */
RoadmapsRouter.all(Paths.Roadmaps.Like, validateSession);
RoadmapsRouter.all(Paths.Roadmaps.Dislike, validateSession);

RoadmapsRouter.get(Paths.Roadmaps.Like, likeRoadmap);
RoadmapsRouter.get(Paths.Roadmaps.Dislike, dislikeRoadmap);

RoadmapsRouter.delete(Paths.Roadmaps.Like, removeLikeRoadmap);
RoadmapsRouter.delete(Paths.Roadmaps.Dislike, removeLikeRoadmap);

export default RoadmapsRouter;
