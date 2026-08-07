import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import TaskScreen from '../screens/TaskScreen';

// Mock dependencies
jest.mock('../store/useAuthStore', () => ({
  __esModule: true,
  default: () => ({
    user: { id: 'usr_123', points: 150 },
    token: 'mock_jwt_token',
  }),
}));

jest.mock('axios', () => ({
  post: jest.fn().mockResolvedValue({ data: {} }),
  get: jest.fn().mockResolvedValue({ data: {} }),
}));

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn().mockResolvedValue('mock_sha256_hash'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('react-native-webview', () => {
  const { View } = require('react-native');
  return { WebView: (props: any) => <View testID="mock-webview" {...props} /> };
});

const mockTask = {
  id: 'task-999',
  title: 'Test YouTube Video Task',
  video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  channel_url: 'https://youtube.com/@testchannel',
  reward_points: 10,
  is_vip: false,
  required_watch_time: 180,
  mcq_question: 'What song was played in the video?',
  mcq_options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
  mcq_answer: 'Option 1',
  platform: 'youtube',
  thumbnail_id: 'thumb_1',
};

const mockNavigation = {
  goBack: jest.fn(),
  navigate: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
};

describe('<TaskScreen /> Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders task title and MCQ question correctly', () => {
    const route = { params: { task: mockTask } };
    const { getByText } = render(
      <TaskScreen route={route} navigation={mockNavigation} />
    );

    expect(getByText('Test YouTube Video Task')).toBeTruthy();
    expect(getByText('What song was played in the video?')).toBeTruthy();
    expect(getByText('Option 1')).toBeTruthy();
    expect(getByText('Option 2')).toBeTruthy();
  });

  it('allows user to select an MCQ option', () => {
    const route = { params: { task: mockTask } };
    const { getByText } = render(
      <TaskScreen route={route} navigation={mockNavigation} />
    );

    const optionBtn = getByText('Option 1');
    fireEvent.press(optionBtn);

    // Selected option displays with checkmark
    expect(getByText('✓ Option 1')).toBeTruthy();
  });

  it('triggers subscribe interaction when Subscribe button is pressed', () => {
    const route = { params: { task: mockTask } };
    const { getByText } = render(
      <TaskScreen route={route} navigation={mockNavigation} />
    );

    const subscribeBtn = getByText(/Subscribe on YouTube/i);
    fireEvent.press(subscribeBtn);

    // Updates button state to Subscribed
    expect(getByText(/Subscribed ✓/i)).toBeTruthy();
  });
});
