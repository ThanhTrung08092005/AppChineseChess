import { useState, useEffect, useRef, useCallback } from 'react';
import * as signalR from '@microsoft/signalr';
import type { GameStateDto } from '../api/gameApi';
import { useSound } from './useSound';

const HUB_URL = (import.meta.env.VITE_API_URL ?? '') + '/hubs/game';

export interface ChatMsg { playerName: string; message: string; time: string; }

export function useOnlineGame(roomId: string, playerId: string, playerName: string) {
  const [state,     setState]     = useState<GameStateDto | null>(null);
  const [connected, setConnected] = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [chat,      setChat]      = useState<ChatMsg[]>([]);
  const [myColor,   setMyColor]   = useState<'red' | 'black' | null>(null);
  const [selected,  setSelected]  = useState<[number,number] | null>(null);

  const hubRef = useRef<signalR.HubConnection | null>(null);
  const prevStatusRef = useRef('');
  const sound = useSound();

  useEffect(() => {
    if (!roomId) return;

    const hub = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    hub.on('GameStateUpdated', (s: GameStateDto) => {
      if (s.status === 'checkmate' && prevStatusRef.current !== 'checkmate')
        s.winner === (myColor === 'red' ? 'red' : 'black') ? sound.playWin() : sound.playLose();
      else if (s.status === 'check') sound.playCheck();
      else sound.playMove();
      prevStatusRef.current = s.status;
      setState(s);
    });

    hub.on('PlayerJoined', (data: any) => {
      setMyColor(data.color === 'black' ? 'black' : 'red');
      setState(data.gameState);
    });

    hub.on('RoomUpdated', (data: any) => {
      setState(data.gameState);
    });

    hub.on('ChatMessage', (msg: ChatMsg) => {
      setChat(prev => [...prev.slice(-49), msg]);
    });

    hub.on('Error', (msg: string) => setError(msg));

    hub.onreconnected(() => {
      setConnected(true);
      hub.invoke('JoinRoom', roomId, playerId, playerName).catch(console.error);
    });

    hub.start()
      .then(() => {
        setConnected(true);
        return hub.invoke('JoinRoom', roomId, playerId, playerName);
      })
      .catch(e => setError(e.message));

    hubRef.current = hub;
    return () => { hub.stop(); };
  }, [roomId]);

  const makeMove = useCallback((fromRow: number, fromCol: number, toRow: number, toCol: number) => {
    hubRef.current?.invoke('MakeMove', roomId, playerId, fromRow, fromCol, toRow, toCol)
      .catch(e => setError(e.message));
  }, [roomId, playerId]);

  const sendChat = useCallback((message: string) => {
    hubRef.current?.invoke('SendMessage', roomId, playerName, message)
      .catch(console.error);
  }, [roomId, playerName]);

  const handleCellClick = useCallback((row: number, col: number) => {
    if (!state || state.status === 'checkmate') return;
    if (state.currentTurn !== myColor) return;

    const cell = state.board[row]?.[col];

    if (!selected) {
      if (cell?.color === myColor) setSelected([row, col]);
      return;
    }

    const isLegal = state.legalMoves.some(
      m => m.fromRow === selected[0] && m.fromCol === selected[1] &&
           m.toRow === row && m.toCol === col
    );

    if (isLegal) {
      makeMove(selected[0], selected[1], row, col);
      setSelected(null);
    } else if (cell?.color === myColor) {
      setSelected([row, col]);
    } else {
      setSelected(null);
    }
  }, [state, selected, myColor, makeMove]);

  return { state, connected, error, chat, myColor, selected, handleCellClick, sendChat };
}
