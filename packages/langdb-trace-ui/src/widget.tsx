import {
  ReactWidget,
  ToolbarButtonComponent,
  listIcon
} from '@jupyterlab/ui-components';
import React from 'react';

interface ITraceProps {
  trace_id: string;
}

function Trace(props: ITraceProps) {
  const onClick = () => {
    window.parent.postMessage(
      { type: 'OpenTrace', traceId: props.trace_id },
      '*'
    );
  };
  return (
    <div data-trace-id={props.trace_id} key={props.trace_id}>
      <div onClick={onClick}>
        <ToolbarButtonComponent icon={listIcon} label="View Traces" />
      </div>
    </div>
  );
}

export class TraceWidget extends ReactWidget {
  private _trace_id: string;

  constructor(trace_id: string) {
    super();
    this._trace_id = trace_id;
  }

  render(): JSX.Element {
    return <Trace trace_id={this._trace_id} />;
  }
}
