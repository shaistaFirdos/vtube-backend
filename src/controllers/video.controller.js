import mongoose, { isValidObjectId } from "mongoose";

import { User } from "../models/user.models.js";

import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { Video } from "../models/video.models.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiReponse.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;

  if (!userId || !mongoose.Types.ObjectId.isValid(userId.toString())) {
    throw new ApiError(400, "Invalid User ID");
  }
  const aggregate = Video.aggregate([
    {
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    },
  ]);

  const fetchedVideos = await Video.aggregatePaginate(aggregate, {
    limit: Number(limit),
    page: Number(page),
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, fetchedVideos, "Videos fetched successfully...")
    );
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description, thumbnail } = req.body;
  // TODO: get video, upload to cloudinary, create video
  const isUser = req.user.id;
  if (!isUser) {
    throw new ApiError("404", "user not found");
  }
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new ApiError("404", "user not found");
  }

  const fileVideoPath = req?.file?.path;

  if (!fileVideoPath) {
    throw new ApiError(404, "video is required");
  }
  const uploadedVideo = await uploadOnCloudinary(fileVideoPath);
  const duration_video = uploadedVideo.duration.toFixed(0);
  const video = await Video.create({
    title,
    description,
    thumbnail,
    videoFile: uploadedVideo.url,
    owner: user._id,
    duration: duration_video,
  });
  if (!video) {
    throw new ApiError("404", "failed to publish");
  }
  await video.save();
  return res
    .status(201)
    .json(new ApiResponse(201, "publish video successfully", video));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  console.log(videoId);
  //TODO: get video by id
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(404, "user not found...");
  }
  const video = await Video.aggregate([
    {
      $match: { _id: new mongoose.Types.ObjectId(videoId) },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "userDetails",
      },
    },
    {
      $unwind: "$userDetails",
    },
    {
      $project: {
        username: "$userDetails.username",
        thumbnail: 1,
        description: 1,
        title: 1,
        views: 1,
        duration: 1,
        videoFile: 1,
      },
    },
  ]);
  if (!video) {
    throw new ApiError(404, "video not found");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, "video fetched successfully...", video));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description, thumbnail } = req.body;

  if (!title.trim() || !description.trim() || !thumbnail.trim()) {
    throw new ApiError(400, "All fields are required");
  }

  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid video ID");
  }

  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    { title, description, thumbnail },
    { new: true }
  ).select("title description thumbnail");

  if (!updatedVideo) {
    throw new ApiError(404, "Video not found");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, "Video details updated successfully", updatedVideo)
    );
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(404, "video not found");
  }

  const video = await Video.findByIdAndDelete(videoId);
  if (!video) {
    throw new ApiError(404, "video not found");
  }
  if (video.owner.toString() !== req.user.id.toString()) {
    throw new ApiError(403, "You are not authorized to delete this video");
  }
  return res.status(200).json({
    success: true,
    message: "video deleted successfully",
    video,
  });
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId || !mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(404, "video not found");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, " video not found");
  }
  video.isPublished = !video.isPublished;

  await video.save();
  return res
    .status(400)
    .json(
      new ApiResponse(200, "Video publish status toggled succesfully...", {})
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};
