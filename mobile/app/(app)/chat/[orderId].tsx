import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
} from 'react-native'
import { useRef, useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAuthStore } from '@/stores/auth'
import { useConversation, useMessages, useSendMessage } from '@/hooks/useChat'
import { Colors } from '@/constants/colors'
import { Fonts, Type } from '@/constants/typography'

export default function ChatScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>()
  const { profile } = useAuthStore()
  const insets = useSafeAreaInsets()
  const [text, setText] = useState('')
  const listRef = useRef<FlatList>(null)

  const { data: conversation, isLoading: loadingConv } = useConversation(orderId)
  const { messages, isLoading: loadingMsgs } = useMessages(conversation?.id)
  const { mutate: sendMessage, isPending: sending } = useSendMessage()

  const handleSend = () => {
    const body = text.trim()
    if (!body || !conversation || !profile) return
    const recipientId =
      profile.id === conversation.buyer_id ? conversation.seller_id : conversation.buyer_id
    setText('')
    sendMessage(
      {
        conversationId: conversation.id,
        senderId: profile.id,
        body,
        recipientId,
        senderName: profile.display_name ?? 'Someone',
      },
      { onSuccess: () => listRef.current?.scrollToEnd({ animated: true }) }
    )
  }

  const isLoading = loadingConv || loadingMsgs

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar barStyle="dark-content" backgroundColor={Colors.white} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Order chat</Text>
          <Text style={styles.headerSub}>Messages are visible to buyer and seller</Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      {/* Messages */}
      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={Colors.black} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.messageList,
            { paddingBottom: 16 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>No messages yet.</Text>
              <Text style={styles.emptyChatSub}>Start the conversation below.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.sender_id === profile?.id
            return (
              <View style={[styles.bubbleRow, isMe && styles.bubbleRowMe]}>
                <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                  <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                    {item.body}
                  </Text>
                  <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
                    {formatTime(item.created_at)}
                  </Text>
                </View>
              </View>
            )
          }}
        />
      )}

      {/* Input */}
      <View style={[styles.inputBar, { paddingBottom: insets.bottom + 12 }]}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={Colors.textDisabled}
          multiline
          maxLength={500}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
          activeOpacity={0.8}
        >
          {sending
            ? <ActivityIndicator color={Colors.white} size="small" />
            : <Feather name="send" size={16} color={Colors.white} />
          }
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-ZM', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    gap: 1,
  },
  headerTitle: {
    ...Type.labelLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  headerSub: {
    ...Type.caption,
    color: Colors.textDisabled,
  },

  // Messages
  messageList: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 6,
  },
  emptyChatText: {
    ...Type.bodyLg,
    color: Colors.textPrimary,
    fontFamily: Fonts.medium,
  },
  emptyChatSub: {
    ...Type.bodyMd,
    color: Colors.textDisabled,
  },

  // Bubbles
  bubbleRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bubbleRowMe: {
    justifyContent: 'flex-end',
  },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 3,
  },
  bubbleMe: {
    backgroundColor: Colors.black,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: Colors.gray100,
    borderBottomLeftRadius: 4,
  },
  bubbleText: {
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
    lineHeight: 21,
  },
  bubbleTextMe: {
    color: Colors.white,
  },
  bubbleTime: {
    fontFamily: Fonts.regular,
    fontSize: 10,
    color: Colors.textDisabled,
    alignSelf: 'flex-end',
  },
  bubbleTimeMe: {
    color: 'rgba(255,255,255,0.5)',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 11,
    fontFamily: Fonts.regular,
    fontSize: 15,
    color: Colors.textPrimary,
    backgroundColor: Colors.white,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: Colors.gray300,
  },
})
