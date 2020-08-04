import {SignalRef} from 'vega';
import {Projection} from '../../projection';
import {Projection as VgProjection} from 'vega';
import {Split} from '../split';

export class ProjectionComponent extends Split<VgProjection> {
  public merged = false;

  constructor(
    name: string,
    public specifiedProjection: Projection,
    public size: SignalRef[],
    public data: (string | SignalRef)[]
  ) {
    super(
      {...specifiedProjection}, // all explicit properties of projection
      {name} // name as initial implicit property
    );
  }

  /**
   * Whether the projection parameters should fit provided data.
   */
  public get isFit() {
    return !!this.data;
  }
}
