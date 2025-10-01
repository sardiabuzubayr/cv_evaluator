import amqp from "amqplib"

let channel
export const QUEUE_EVALUATE = "evaluation_jobs"
export const QUEUE_EXTRACT_CV = "extract_cv"

export async function connectQueue() {
    const dsn = `amqp://${process.env.RABBITMQ_USERNAME}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_IP}:${process.env.RABBITMQ_PORT}/${process.env.RABBITMQ_VHOST}`
    const conn = await amqp.connect(dsn)
    channel = await conn.createChannel()
    await channel.assertQueue(QUEUE_EVALUATE, { durable: true })
    await channel.assertQueue(QUEUE_EXTRACT_CV, { durable: true })
    return channel
}

export async function sendJob(jobName, job) {
  channel.sendToQueue(jobName, Buffer.from(JSON.stringify(job)), { persistent: true })
}
