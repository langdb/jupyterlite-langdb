import { autoUpdate, useDismiss, useFloating, useInteractions, offset, flip, shift, useClick, useRole, FloatingFocusManager, FloatingPortal } from '@floating-ui/react';
import { ReactWidget, ToolbarButtonComponent, listIcon } from '@jupyterlab/ui-components';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import React, { useEffect, useId, useState } from 'react';

export type AuthResponse = {
    token?: string;
    appId: string;
    apiUrl: string;
    publicApp?: boolean;
};
interface IPopoverProps {
    trace_id: string
}

const getHeaders = (auth: AuthResponse): Record<string, string> => {
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${auth?.token}`,
    };
};

interface Span {
    trace_id: string,
    span_id: string,
    parent_span_id: string | null,
    operation_name: String,
    start_time_us: number,
    finish_time_us: number,
    attribute: Map<string, any>,
}

function Popover(props: IPopoverProps) {
    const [isOpen, setIsOpen] = useState(false);

    const { refs, floatingStyles, context } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        middleware: [
            offset(10),
            flip({ fallbackAxisSideDirection: "end" }),
            shift()
        ],
        whileElementsMounted: autoUpdate
    });

    const click = useClick(context);
    const dismiss = useDismiss(context);
    const role = useRole(context);

    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss, role
    ]);
    const heading_id = useId();

    const [data, setData] = useState<Span[]>([]);
    useEffect(() => {
        const get_events = async () => {
            function requestSession(): Promise<AuthResponse> {
                return new Promise((resolve, reject) => {
                    const messageHandler = (event: any) => {
                        console.log('received event');
                        if (event.data.type === 'AuthResponse') {
                            window.removeEventListener('message', messageHandler);
                            resolve(event.data.msg);
                        }
                    };
                    window.addEventListener('message', messageHandler);
                    window.parent.postMessage({ type: 'AuthRequest' }, '*');

                    setTimeout(() => {
                        window.removeEventListener('message', messageHandler);
                        reject(new Error('Session request timed out'));
                    }, 2000); // 5 seconds timeout
                });
            }
            const session = await requestSession();
            await fetchEventSource(`${session?.apiUrl}/trace/${props.trace_id}`, {
                headers: getHeaders(session),
                onmessage(event) {
                    console.log(event.data);
                    const parsedData = JSON.parse(event.data);
                    setData((data) => [...data, parsedData]);
                },
                onerror(err) {
                    console.log(err);
                },
            })
        }
        get_events()
    }, [props.trace_id]);
    return (
        <div data-trace-id={props.trace_id} key={props.trace_id}>
            <div ref={refs.setReference} {...getReferenceProps()}>
                <ToolbarButtonComponent icon={listIcon} label='traces' />
            </div>
            {isOpen && (
                <FloatingPortal>
                    <FloatingFocusManager context={context} modal={false}>
                        <div
                            className="langdb-tracing-popover"
                            ref={refs.setFloating}
                            style={floatingStyles}
                            aria-labelledby={heading_id}
                            {...getFloatingProps()}
                        >
                            <h4 id={heading_id}>Traces</h4>
                            <table>
                                <tr>
                                    <th>Span ID</th>
                                    <th>Parent Span ID</th>
                                    <th>Operation</th>
                                    <th>Duration(ms)</th>
                                    <th>Attributes</th>
                                </tr>
                                ...{data.map((span) => <tr>
                                    <td>{span.span_id}</td>
                                    <td>{span.parent_span_id}</td>
                                    <td>{span.operation_name}</td>
                                    <td>{((span.finish_time_us - span.start_time_us) / 1000).toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td>{JSON.stringify(span.attribute)}</td>
                                </tr>
                                )}
                            </table>
                        </div>
                    </FloatingFocusManager>
                </FloatingPortal>
            )}
        </div>
    );
}

export class PopoverWidget extends ReactWidget {
    private _trace_id: string;

    constructor(trace_id: string) {
        super();
        this._trace_id = trace_id;
    }

    render(): JSX.Element {
        return <Popover trace_id={this._trace_id} />;
    }
}

