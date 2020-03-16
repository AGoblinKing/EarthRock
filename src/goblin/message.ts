export interface IMessage {
    name: string
    data?: any
}

export interface IMessageEvent {
    data: IMessage
}
