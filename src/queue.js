import amqp from "amqplib"

let channel
const QUEUE = "evaluation_jobs"

export async function connectQueue() {
    const dsn = `amqp://${process.env.RABBITMQ_USERNAME}:${process.env.RABBITMQ_PASSWORD}@${process.env.RABBITMQ_IP}:${process.env.RABBITMQ_PORT}/${process.env.RABBITMQ_VHOST}`
    const conn = await amqp.connect(dsn)
    channel = await conn.createChannel()
    await channel.assertQueue(QUEUE, { durable: true })
    return channel
}

export async function sendJob(job) {
  channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(job)), { persistent: true })
}
