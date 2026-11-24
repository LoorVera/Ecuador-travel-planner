import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Affix,
  Alert,
  Badge,
  Box,
  Button,
  Card,
  Drawer,
  Group,
  Loader,
  Paper,
  ScrollArea,
  Stack,
  Text,
  Textarea,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconCheck,
  IconMapPin,
  IconRefresh,
  IconSend,
  IconSparkles,
} from '@tabler/icons-react';
import { DESTINOS_ECUADOR } from '../data/destinos';
import { solicitarSugerencias } from '../lib/gemini';
import { useAuthStore } from '../store/useAuthStore';
import { useBudgetStore } from '../store/useBudgetStore';

const CHIPS_INICIALES = [
  'Playa y surf en 4 días',
  'Aventura en la Amazonía',
  'Cultura e historia en la Sierra',
  'Viajo con niños y presupuesto ajustado',
];

let contadorId = 0;
const nuevoId = () => {
  contadorId += 1;
  return contadorId;
};

function BurbujaUsuario({ children }) {
  return (
    <Box style={{ alignSelf: 'flex-end', maxWidth: '88%' }}>
      <Paper bg="blue.6" c="white" p="sm" radius="lg" style={{ borderBottomRightRadius: 4 }}>
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {children}
        </Text>
      </Paper>
    </Box>
  );
}

function BurbujaAsistente({ children }) {
  return (
    <Box style={{ alignSelf: 'flex-start', maxWidth: '92%' }}>
      <Paper bg="gray.0" p="sm" radius="lg" style={{ borderBottomLeftRadius: 4 }}>
        {children}
      </Paper>
    </Box>
  );
}

export default function AiChatWidget() {
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const [cargando, setCargando] = useState(false);

  const viewportRef = useRef(null);
  const abortRef = useRef(null);

  const { user, openAuthModal } = useAuthStore();
  const { items, addItem } = useBudgetStore();

  useEffect(() => {
    if (!abierto) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
  }, [mensajes, cargando, abierto]);

  const enviar = async (contenido) => {
    const limpio = contenido.trim();
    if (!limpio || cargando) return;

    const mensajeUsuario = { id: nuevoId(), role: 'user', content: limpio };
    const historial = [...mensajes, mensajeUsuario];

    setMensajes(historial);
    setTexto('');
    setCargando(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const respuesta = await solicitarSugerencias(
        historial
          .filter((mensaje) => !mensaje.error)
          .map(({ role, content }) => ({ role, content })),
        { signal: controller.signal },
      );

      setMensajes((prev) => [...prev, { id: nuevoId(), role: 'assistant', ...respuesta }]);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      setMensajes((prev) => [
        ...prev,
        {
          id: nuevoId(),
          role: 'assistant',
          error: true,
          content:
            error?.message ||
            'No pude obtener sugerencias en este momento. Intenta de nuevo en unos segundos.',
        },
      ]);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setCargando(false);
    }
  };

  const limpiar = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMensajes([]);
    setTexto('');
    setCargando(false);
  };

  const agregarAlItinerario = (sugerencia, destino) => {
    if (!destino) return;
    if (!user) {
      openAuthModal();
      return;
    }
    addItem(user.uid, destino);
  };

  const resolverDestino = (sugerencia) =>
    DESTINOS_ECUADOR.find((destino) => destino.id === sugerencia.destinoId) ||
    DESTINOS_ECUADOR.find((destino) => destino.nombre === sugerencia.nombre) ||
    null;

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      enviar(texto);
    }
  };

  return (
    <>
      <Affix position={{ bottom: 22, right: 22 }} zIndex={170}>
        <Tooltip label="Sugerencias de viaje con IA" position="left" withArrow>
          <ActionIcon
            size={58}
            radius="xl"
            variant="gradient"
            gradient={{ from: 'blue', to: 'teal', deg: 45 }}
            aria-label="Abrir asistente de viajes con IA"
            onClick={() => setAbierto(true)}
            style={{ boxShadow: '0 8px 24px rgba(34, 139, 230, 0.35)' }}
          >
            <IconSparkles size={27} />
          </ActionIcon>
        </Tooltip>
      </Affix>

      <Drawer
        opened={abierto}
        onClose={() => setAbierto(false)}
        position="right"
        size="md"
        zIndex={180}
        title={
          <Group gap="sm">
            <ThemeIcon size={38} radius="xl" variant="gradient" gradient={{ from: 'blue', to: 'teal', deg: 45 }}>
              <IconSparkles size={21} />
            </ThemeIcon>
            <div>
              <Text fw={700} size="sm">
                Asistente de viajes
              </Text>
              <Text size="xs" c="dimmed">
                Sugerencias con Gemini
              </Text>
            </div>
          </Group>
        }
        styles={{
          content: {
            maxWidth: '100vw',
            display: 'flex',
            flexDirection: 'column',
          },
          header: {
            flexShrink: 0,
            borderBottom: '1px solid var(--mantine-color-gray-2)',
          },
          body: {
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
          },
        }}
      >
        <ScrollArea style={{ flex: 1, minHeight: 0 }} viewportRef={viewportRef} px="md" py="md" type="hover">
          <Stack gap="md">
            {mensajes.length > 0 && (
              <Group justify="flex-end">
                <Button
                  variant="subtle"
                  color="gray"
                  size="compact-xs"
                  leftSection={<IconRefresh size={12} />}
                  onClick={limpiar}
                >
                  Nueva conversación
                </Button>
              </Group>
            )}

            {mensajes.length === 0 && !cargando && (
              <Stack gap="sm">
                <Paper bg="blue.0" p="md" radius="lg">
                  <Group gap="xs" mb={6}>
                    <IconSparkles size={18} color="#228be6" />
                    <Text fw={600} size="sm">
                      ¡Hola! Soy RutaBot
                    </Text>
                  </Group>
                  <Text size="sm">
                    Cuéntame qué tipo de viaje buscas por Ecuador: playa, montaña, Amazonía, cultura,
                    presupuesto, días disponibles o con quién viajas. Te propongo destinos y puedes
                    agregarlos a tu itinerario.
                  </Text>
                </Paper>

                <Text size="xs" c="dimmed" fw={600}>
                  Prueba con:
                </Text>
                <Group gap="xs">
                  {CHIPS_INICIALES.map((chip) => (
                    <Button
                      key={chip}
                      variant="light"
                      color="blue"
                      size="compact-sm"
                      radius="xl"
                      onClick={() => enviar(chip)}
                    >
                      {chip}
                    </Button>
                  ))}
                </Group>
              </Stack>
            )}

            {mensajes.map((mensaje) => {
              if (mensaje.role === 'user') {
                return <BurbujaUsuario key={mensaje.id}>{mensaje.content}</BurbujaUsuario>;
              }

              if (mensaje.error) {
                return (
                  <Box key={mensaje.id} style={{ alignSelf: 'flex-start', maxWidth: '95%' }}>
                    <Alert
                      color="red"
                      variant="light"
                      icon={<IconAlertCircle size={16} />}
                      title="No pude responder"
                    >
                      <Text size="sm">{mensaje.content}</Text>
                    </Alert>
                  </Box>
                );
              }

              return (
                <BurbujaAsistente key={mensaje.id}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
                    {mensaje.mensaje}
                  </Text>

                  {mensaje.sugerencias?.length > 0 && (
                    <Stack gap="xs" mt="sm">
                      {mensaje.sugerencias.map((sugerencia, indice) => {
                        const destino = resolverDestino(sugerencia);
                        const yaAgregado = destino
                          ? items.some((item) => item.id === destino.id)
                          : false;

                        return (
                          <Card
                            key={`${mensaje.id}-${sugerencia.destinoId}-${indice}`}
                            withBorder
                            radius="md"
                            p="sm"
                            bg="white"
                          >
                            <Group gap={6} wrap="nowrap" align="flex-start">
                              <IconMapPin size={16} color="#228be6" style={{ marginTop: 2 }} />
                              <div style={{ flex: 1 }}>
                                <Text fw={600} size="sm">
                                  {sugerencia.nombre}
                                </Text>
                                <Group gap={6} mt={4} wrap="wrap">
                                  <Badge size="xs" variant="light" color="teal">
                                    {sugerencia.region}
                                  </Badge>
                                  <Text size="xs" c="dimmed">
                                    {sugerencia.diasSugeridos}{' '}
                                    {sugerencia.diasSugeridos === 1 ? 'día' : 'días'} · ~$
                                    {sugerencia.precioEstimado} USD
                                  </Text>
                                </Group>
                              </div>
                            </Group>

                            {sugerencia.motivo && (
                              <Text size="xs" mt={6}>
                                {sugerencia.motivo}
                              </Text>
                            )}

                            {destino ? (
                              <Button
                                mt="sm"
                                size="compact-sm"
                                fullWidth
                                color={yaAgregado ? 'teal' : 'blue'}
                                variant={yaAgregado ? 'light' : 'filled'}
                                leftSection={yaAgregado ? <IconCheck size={14} /> : null}
                                disabled={yaAgregado}
                                onClick={() => agregarAlItinerario(sugerencia, destino)}
                              >
                                {yaAgregado
                                  ? 'En tu itinerario'
                                  : user
                                    ? 'Agregar al itinerario'
                                    : 'Inicia sesión para agregar'}
                              </Button>
                            ) : (
                              <Text size="xs" c="dimmed" mt={6}>
                                Sugerencia fuera del catálogo actual.
                              </Text>
                            )}
                          </Card>
                        );
                      })}
                    </Stack>
                  )}

                  {mensaje.preguntasSugeridas?.length > 0 && !cargando && (
                    <Group gap="xs" mt="sm">
                      {mensaje.preguntasSugeridas.map((pregunta) => (
                        <Button
                          key={`${mensaje.id}-${pregunta}`}
                          variant="subtle"
                          color="blue"
                          size="compact-xs"
                          radius="xl"
                          onClick={() => enviar(pregunta)}
                        >
                          {pregunta}
                        </Button>
                      ))}
                    </Group>
                  )}
                </BurbujaAsistente>
              );
            })}

            {cargando && (
              <BurbujaAsistente>
                <Group gap="xs" wrap="nowrap">
                  <Loader size="xs" color="blue" />
                  <Text size="sm" c="dimmed">
                    Buscando los mejores lugares para ti…
                  </Text>
                </Group>
              </BurbujaAsistente>
            )}
          </Stack>
        </ScrollArea>

        <Box px="md" pt="sm" pb="md" style={{ borderTop: '1px solid var(--mantine-color-gray-2)' }}>
          <Group align="flex-end" gap="xs" wrap="nowrap">
            <Textarea
              style={{ flex: 1 }}
              value={texto}
              onChange={(event) => setTexto(event.currentTarget.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej. Quiero playa, 5 días y menos de $250…"
              aria-label="Mensaje para el asistente de viajes"
              autosize
              minRows={1}
              maxRows={4}
              maxLength={600}
              disabled={cargando}
            />
            <ActionIcon
              size={38}
              radius="md"
              color="blue"
              aria-label="Enviar mensaje"
              onClick={() => enviar(texto)}
              loading={cargando}
              disabled={!texto.trim()}
            >
              <IconSend size={18} />
            </ActionIcon>
          </Group>
          <Text size="xs" c="dimmed" ta="center" mt={6}>
            Sugerencias generadas con IA. Verifica precios y disponibilidad.
          </Text>
        </Box>
      </Drawer>
    </>
  );
}
