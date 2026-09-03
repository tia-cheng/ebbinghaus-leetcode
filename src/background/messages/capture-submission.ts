/**
 * Background 消息处理器：接收来自 content script 的 Accepted 提交上报，
 * 写入复习队列。使用 @plasmohq/messaging 的约定：
 * 文件名 "capture-submission" 即消息的 name，
 * content script 通过 sendToBackground({ name: "capture-submission", body }) 调用。
 */
import type { PlasmoMessaging } from "@plasmohq/messaging"

import { logger } from "~lib/logger"
import { upsertOnAccepted } from "~lib/storage"
import type { AcceptedSubmissionPayload, ProblemRecord } from "~lib/types"

export interface CaptureSubmissionResponse {
  ok: boolean
  record?: ProblemRecord
  isNew?: boolean
}

const handler: PlasmoMessaging.MessageHandler<AcceptedSubmissionPayload, CaptureSubmissionResponse> = async (
  req,
  res
) => {
  try {
    const payload = req.body

    if (!payload?.problemId || !payload.url) {
      logger.warn("收到的 Accepted 上报数据不完整，已忽略：", payload)
      res.send({ ok: false })
      return
    }

    const { record, isNew } = await upsertOnAccepted(payload)
    res.send({ ok: true, record, isNew })
  } catch (err) {
    logger.error("处理 Accepted 提交上报时出错：", err)
    res.send({ ok: false })
  }
}

export default handler
