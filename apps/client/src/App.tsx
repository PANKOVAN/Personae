import logoImg from "../logo.png";
import { AppToolbar } from "./components/AppToolbar";
import { SettingsModal } from "./components/SettingsModal";
import { visualizerColWidths } from "./layoutCols";
import { appStore } from "./store/appStore";
import { ResultVisualizer } from "./visualizers/ResultVisualizer";
import { ShelfVisualizer } from "./visualizers/ShelfVisualizer";
import { SourceVisualizer } from "./visualizers/SourceVisualizer";
import { observer } from "mobx-react-lite";
import { useEffect } from "react";
import { Col, Container, Content, Grid, Header, Heading, Message, Row, toaster } from "rsuite";

export const App = observer(function App() {
    useEffect(() => {
        void appStore.getHealth();
        void appStore.getShelves();
        void appStore.getBooks();
    }, []);

    useEffect(() => {
        if (!appStore.error) {
            return;
        }
        const text = appStore.error;
        void (async () => {
            let toastKey: string | undefined;
            toastKey = await toaster.push(
                <div
                    role="button"
                    tabIndex={0}
                    className="personae-error-toast"
                    title="Нажмите, чтобы закрыть"
                    onClick={() => toastKey && toaster.remove(toastKey)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toastKey && toaster.remove(toastKey);
                        }
                    }}
                >
                    <Message type="error" showIcon>
                        {text}
                    </Message>
                </div>,
                { placement: "topEnd", duration: 0, mouseReset: false },
            );
        })();
    }, [appStore.error]);

    const w = visualizerColWidths(appStore);

    return (
        <Container className="personae-layout">
            <Header className="personae-app-header">
                <img src={logoImg} alt="Personae" className="personae-app-logo" />
                <Heading level={4}>Personae</Heading>
            </Header>
            <Content className="personae-app-content">
                <Grid fluid className="personae-app-main-grid">
                    <Row className="personae-row-stretch personae-app-main-row" gutter={12}>
                        <Col xs={24} md={1} className="personae-col-toolbar">
                            <AppToolbar store={appStore} />
                        </Col>
                        {appStore.showContents ? (
                            <Col xs={24} md={w.shelf} className="personae-col-visualizer">
                                <ShelfVisualizer store={appStore} />
                            </Col>
                        ) : null}
                        <Col xs={24} md={w.source} className="personae-col-visualizer">
                            <SourceVisualizer store={appStore} />
                        </Col>
                        {appStore.showResult ? (
                            <Col xs={24} md={w.result} className="personae-col-visualizer">
                                <ResultVisualizer store={appStore} />
                            </Col>
                        ) : null}
                    </Row>
                </Grid>
            </Content>
            <SettingsModal store={appStore} />
        </Container>
    );
});
