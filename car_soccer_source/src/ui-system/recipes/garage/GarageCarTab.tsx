import React from 'react';
import { Check } from 'lucide-react';
import { Badge } from '../../primitives/Badge';
import { CARS, CarDef } from './garageConstants';

export interface GarageCarTabProps {
  activeCar: string;
  onSelectCar: (carId: string) => void;
  onHoverCar: (car: CarDef) => void;
  onLeaveCar: () => void;
  isLight?: boolean;
}

export const GarageCarTab: React.FC<GarageCarTabProps> = ({
  activeCar,
  onSelectCar,
  onHoverCar,
  onLeaveCar,
  isLight = false,
}) => {
  const currentCarDef = CARS.find((c) => c.id === activeCar) || CARS[0];

  return (
    <div className="flex flex-col gap-3" data-ui-element="garage-tab-car">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-semibold flex items-center gap-1.5 ${isLight ? 'text-neutral-700' : 'text-neutral-300'}`}>
                <span>Equipped Chassis:</span>
                <strong className="text-amber-500 font-bold uppercase">{currentCarDef.name}</strong>
              </span>
              <span className="text-[11px] font-mono opacity-70">
                8 Standard Models • Click to Equip
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              {CARS.map((car) => {
                const isSelected = activeCar === car.id;
                return (
                  <button
                    key={car.id}
                    type="button"
                    data-ui-element="car-card"
                    data-car-id={car.id}
                    data-equipped={isSelected}
                    onClick={() => onSelectCar(car.id)}
                    onMouseEnter={() => onHoverCar(car)}
                    onMouseLeave={onLeaveCar}
                    className={`flex flex-col items-center justify-center p-3.5 rounded-xl border text-center transition-all cursor-pointer relative min-h-[76px] gap-1.5 ${
                      isSelected
                        ? isLight
                          ? 'bg-amber-50/90 border-amber-500 ring-2 ring-amber-500/40 text-neutral-900 shadow-xs'
                          : 'bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/50 text-white shadow-md'
                        : isLight
                        ? 'bg-neutral-50 hover:bg-white border-neutral-200/90 text-neutral-800'
                        : 'bg-neutral-850 hover:bg-neutral-800 border-neutral-700/80 text-neutral-200'
                    }`}
                  >
                    {isSelected && (
                      <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                      </span>
                    )}
                    <span className="font-bold text-xs truncate max-w-full">
                      {car.name}
                    </span>
                    <div className="flex items-center gap-1">
                      <Badge
                        variant={isSelected ? 'amber' : 'neutral'}
                        size="sm"
                        isLight={isLight}
                      >
                        {car.hitbox}
                      </Badge>
                      {isSelected && (
                        <span className="text-[10px] font-mono text-amber-500 font-bold">
                          Equipped
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
  );
};
