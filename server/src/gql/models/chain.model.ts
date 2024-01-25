import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';

@ObjectType()
export class Chain {
  @Field({
    description: 'chain identifier',
  })
  type: string;

  @Field({
    description: 'chain readable name',
  })
  name: string;

  @Field({
    description: 'story factory address',
  })
  factoryAddress: string;

  @Field({
  })
  findsAddress: string;
}
