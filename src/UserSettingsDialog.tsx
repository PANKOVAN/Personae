/**
 * UserSettingsDialog — модальное окно настроек Personae (React Suite).
 *
 * Редактирование настроек из {@link LocalSettings}; сохранение через saveSettings().
 * При открытии поднимается черновик из getSettings(); «Отмена» без записи.
 */

import { useEffect, useState } from "react";
import { Button, Form, Modal, Nav, SelectPicker, Stack, Text } from "rsuite";

import { Codicon } from "./Codicon";
import LocalSettings, { type Settings } from "./settings";

const NAV_ICON = 16;

type SettingsSection = "storage" | "about";

const storageOptions = [
  { label: "IndexedDB (локально в браузере)", value: "indexeddb" as const },
  { label: "GitHub", value: "github" as const },
];

export type UserSettingsDialogProps = {
  open: boolean;
  onClose: () => void;
};

export function UserSettingsDialog({ open, onClose }: UserSettingsDialogProps) {
  const [draft, setDraft] = useState<Settings>(() => ({ storageType: "indexeddb" }));
  const [section, setSection] = useState<SettingsSection>("storage");

  useEffect(() => {
    if (open) {
      setDraft({ ...LocalSettings.getSettings() });
      setSection("storage");
    }
  }, [open]);

  const handleSave = () => {
    Object.assign(LocalSettings.getSettings(), draft);
    LocalSettings.saveSettings();
    onClose();
  };

  const handleDefault = () => {
    setDraft({ ...LocalSettings.restoreDefault() });
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Modal open={open} onClose={handleCancel} size="md" overflow>
      <Modal.Header>
        <Modal.Title>Настройки</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ padding: 0 }}>
        <Stack direction="row" alignItems="stretch" style={{ minHeight: 280 }}>
          <Stack
            direction="column"
            style={{
              flex: "none",
              width: 200,
              borderRight: "1px solid var(--rs-border-primary)",
              padding: "8px 0",
            }}
          >
            <Nav
              vertical
              appearance="tabs"
              activeKey={section}
              onSelect={(key) => {
                if (key === "about" || key === "storage") setSection(key);
              }}
            >
              <Nav.Item
                eventKey="about"
                icon={<Codicon name="info" size={NAV_ICON} />}
              >
                О приложении
              </Nav.Item>
              <Nav.Item
                eventKey="storage"
                icon={<Codicon name="database" size={NAV_ICON} />}
              >
                Хранилище
              </Nav.Item>
            </Nav>
          </Stack>
          <Stack direction="column" style={{ flex: 1, padding: 16, minWidth: 0 }}>
            {section === "storage" ? (
              <Form fluid>
                <Form.Group controlId="storage-type">
                  <Form.Label>Тип хранилища</Form.Label>
                  <SelectPicker
                    data={storageOptions}
                    searchable={false}
                    cleanable={false}
                    value={draft.storageType}
                    onChange={(v) => {
                      if (v === "indexeddb" || v === "github") {
                        setDraft((d) => ({ ...d, storageType: v }));
                      }
                    }}
                    style={{ width: "100%" }}
                  />
                </Form.Group>
              </Form>
            ) : (
              <Text as="div" size="md">
                Personae — клиентское приложение. Настройки сохраняются в браузере (localStorage).
              </Text>
            )}
          </Stack>
        </Stack>
      </Modal.Body>
      <Modal.Footer>
        <Button onClick={handleDefault}>По умолчанию</Button>
        <Button onClick={handleCancel}>Отмена</Button>
        <Button appearance="primary" onClick={handleSave}>
          Сохранить
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
